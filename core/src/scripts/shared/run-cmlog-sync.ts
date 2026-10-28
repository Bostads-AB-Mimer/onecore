import { logger } from '@onecore/utilities'

import {
  appendEntry,
  readQueue,
  removeEntry,
  writeQueue,
  FailedRowEntry,
} from './failed-sync-queue'
import { getLastTimestamp, saveLastTimestamp } from './last-timestamp'
import { notifyXpandSync } from './notify'
import type { SyncStepsFailure } from '../../processes/sync-steps'

const HOUR_MS = 60 * 60 * 1000
const RETRY_EVERY_RUN_FOR_MS = 24 * HOUR_MS
const SLOW_RETRY_INTERVAL_MS = 6 * HOUR_MS
const DAILY_RETRY_AFTER_MS = 7 * 24 * HOUR_MS
const DAILY_RETRY_INTERVAL_MS = 24 * HOUR_MS
const GIVE_UP_AFTER_MS = 30 * 24 * HOUR_MS

const retryIntervalFor = (failingFor: number) =>
  failingFor < RETRY_EVERY_RUN_FOR_MS
    ? 0
    : failingFor < DAILY_RETRY_AFTER_MS
      ? SLOW_RETRY_INTERVAL_MS
      : DAILY_RETRY_INTERVAL_MS

const DEFAULT_GIVE_UP_ADVICE =
  'Gör ändringen i Xpand på nytt för att försöka igen.'

export type SyncOutcome = void | { skipped: string }

export class SyncFailedError extends Error {
  readonly undoFailed: string[]

  constructor({ message, undoFailed }: SyncStepsFailure) {
    super(message)
    this.name = 'SyncFailedError'
    this.undoFailed = undoFailed
  }
}

export type CmlogSync<T> = {
  name: string
  entryType: FailedRowEntry['type']
  // 'start-now' saves the newest row on a run without a saved timestamp and syncs nothing.
  firstRun: 'sync-all' | 'start-now'
  // `until` is the newest cmlog row read, parsed or not; it is saved as the
  // timestamp when it is later than the last change.
  fetchChanges: (
    since: Date | null
  ) => Promise<
    { ok: true; data: T[]; until?: Date } | { ok: false; err: string }
  >
  sync: (change: T) => Promise<SyncOutcome>
  keyFor: (change: T) => string
  // Changes sharing a supersede key replace each other: only the newest is synced.
  supersedeKey?: (change: T) => string
  timestampOf: (change: T) => Date
  toPayload: (change: T) => unknown
  fromPayload: (payload: unknown) => T
  describe: (change: T) => { subject: string; detail: string }
  giveUpAdvice?: string
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

export const runCmlogSync = async <T>(
  def: CmlogSync<T>,
  opts: { stateFile: string; queueFile: string; now?: () => Date }
) => {
  const { stateFile, queueFile } = opts
  const now = opts.now ?? (() => new Date())

  const notifyFailure = (change: T, entry: FailedRowEntry) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(`${def.name}: nytt fel på ${subject}`, [
      `Misslyckades på ${detail} vid ${def.timestampOf(change).toISOString()}.`,
      `Fel: ${entry.lastError}`,
      ``,
      `Raden ligger nu i återförsökskön på PVC (/data/failed-rows.jsonl). Den försöks igen varje minut i ett dygn, var sjätte timme resten av första veckan och sedan en gång om dygnet i upp till 30 dagar. Du får ett bekräftelsemail när den lyckas synkas.`,
    ])
  }

  const notifyStillFailing = (change: T, entry: FailedRowEntry) => {
    const { subject, detail } = def.describe(change)
    const giveUpAt = new Date(
      new Date(entry.retriesStartedAt ?? entry.addedAt).getTime() +
        GIVE_UP_AFTER_MS
    ).toISOString()
    return notifyXpandSync(`${def.name}: ${subject} misslyckas fortfarande`, [
      `${capitalize(detail)} har misslyckats sedan ${entry.addedAt}.`,
      `Senaste fel: ${entry.lastError}`,
      ``,
      `Raden försöks nu igen var sjätte timme resten av första veckan och sedan en gång om dygnet till ${giveUpAt}, och tas sedan bort ur återförsökskön.`,
    ])
  }

  // A later retry's undo writes back what the failed one left, so a target
  // stays changed until the row syncs.
  const newUndoFailures = (
    entry: FailedRowEntry | undefined,
    err: unknown
  ): string[] =>
    err instanceof SyncFailedError
      ? err.undoFailed.filter((t) => !entry?.undoFailedIn?.includes(t))
      : []

  const withUndoFailures = (
    entry: FailedRowEntry,
    targets: string[]
  ): FailedRowEntry =>
    targets.length
      ? { ...entry, undoFailedIn: [...(entry.undoFailedIn ?? []), ...targets] }
      : entry

  const notifyUndoFailed = (
    change: T,
    entry: FailedRowEntry,
    targets: string[]
  ) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(
      `${def.name}: återställning misslyckades för ${subject}`,
      [
        `${capitalize(detail)} synkades bara delvis, och ändringen kunde inte återställas i: ${targets.join(', ')}.`,
        `Fel: ${entry.lastError}`,
        ``,
        `Dessa system har kvar ändringen medan övriga inte har den. Kräver manuell kontroll.`,
      ]
    )
  }

  const notifyGiveUp = (change: T, entry: FailedRowEntry) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(`${def.name}: ger upp ${subject}`, [
      `${capitalize(detail)} har misslyckats sedan ${entry.addedAt}.`,
      `Senaste fel: ${entry.lastError}`,
      ...(entry.undoFailedIn?.length
        ? [
            `Ändringen kunde inte återställas i: ${entry.undoFailedIn.join(', ')}. Dessa system har kvar ändringen medan övriga inte har den.`,
          ]
        : []),
      ``,
      `Raden har tagits bort ur återförsökskön och försöks inte igen. ${def.giveUpAdvice ?? DEFAULT_GIVE_UP_ADVICE}`,
    ])
  }

  const notifyRecovery = (change: T, entry: FailedRowEntry) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(
      `${def.name}: tidigare felande ${subject} är nu synkat`,
      [
        `${capitalize(detail)} är nu synkat.`,
        `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
      ]
    )
  }

  const notifySkipped = (change: T, entry: FailedRowEntry, reason: string) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(
      `${def.name}: tidigare felande ${subject} synkades inte`,
      [
        `${capitalize(detail)} synkades inte: ${reason}.`,
        `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
        ``,
        `Raden har tagits bort ur återförsökskön.`,
      ]
    )
  }

  const notifySuperseded = (change: T, entry: FailedRowEntry) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(
      `${def.name}: tidigare felande ${subject} ersatt av en senare ändring`,
      [
        `${capitalize(detail)} försöks inte igen, eftersom en senare ändring har kommit.`,
        `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
      ]
    )
  }

  const notifyResolved = (
    change: T,
    entry: FailedRowEntry,
    outcome: SyncOutcome
  ) =>
    outcome
      ? notifySkipped(change, entry, outcome.skipped)
      : notifyRecovery(change, entry)

  const lastTimestamp = await getLastTimestamp(stateFile)
  const skipExisting = !lastTimestamp && def.firstRun === 'start-now'
  if (lastTimestamp) {
    logger.info({ lastTimestamp }, 'syncing since last timestamp')
  } else if (skipExisting) {
    logger.info('no saved timestamp, starting from the newest row')
  } else {
    logger.info('no saved timestamp, syncing all')
  }
  const result = await def.fetchChanges(lastTimestamp)
  const fetched = result.ok && !skipExisting ? result.data : []

  // 1) Retry the queue
  const queue = await readQueue(queueFile)
  logger.info({ queueDepth: queue.length }, 'draining failure queue')

  const newestBySupersedeKey = new Map<string, number>()
  if (def.supersedeKey) {
    const supersedeKey = def.supersedeKey
    const candidates = [
      ...queue
        .filter((e) => e.type === def.entryType)
        .map((e) => def.fromPayload(e.payload)),
      ...fetched,
    ]
    for (const change of candidates) {
      const key = supersedeKey(change)
      const time = def.timestampOf(change).getTime()
      if (time > (newestBySupersedeKey.get(key) ?? -Infinity))
        newestBySupersedeKey.set(key, time)
    }
  }
  const isSuperseded = (change: T) =>
    def.supersedeKey !== undefined &&
    def.timestampOf(change).getTime() <
      (newestBySupersedeKey.get(def.supersedeKey(change)) ?? -Infinity)

  const kept: FailedRowEntry[] = []
  let queueChanged = false
  for (const entry of queue) {
    if (entry.type !== def.entryType) {
      kept.push(entry)
      continue
    }
    const change = def.fromPayload(entry.payload)
    if (isSuperseded(change)) {
      queueChanged = true
      logger.info(
        { key: entry.key },
        `${def.name}: queued entry replaced by a newer change, dropping`
      )
      await notifySuperseded(change, entry)
      continue
    }
    const retriesStartedAt =
      entry.retriesStartedAt ??
      (entry.lastAttemptAt ? entry.addedAt : now().toISOString())
    const failingFor = now().getTime() - new Date(retriesStartedAt).getTime()
    const sinceLastAttempt =
      now().getTime() - new Date(entry.lastAttemptAt ?? entry.addedAt).getTime()
    if (sinceLastAttempt < retryIntervalFor(failingFor)) {
      kept.push(entry)
      continue
    }
    queueChanged = true
    try {
      const outcome = await def.sync(change)
      await notifyResolved(change, entry, outcome)
    } catch (err) {
      const undoFailed = newUndoFailures(entry, err)
      const updated: FailedRowEntry = withUndoFailures(
        {
          ...entry,
          ...(retriesStartedAt !== entry.addedAt && { retriesStartedAt }),
          lastAttemptAt: now().toISOString(),
          lastError: errorMessage(err),
        },
        undoFailed
      )
      if (undoFailed.length) await notifyUndoFailed(change, updated, undoFailed)
      if (failingFor >= GIVE_UP_AFTER_MS) {
        await notifyGiveUp(change, updated)
        logger.error(
          { err, key: entry.key },
          `${def.name}: queued entry failed for 30 days, giving up`
        )
        continue
      }
      if (
        failingFor >= RETRY_EVERY_RUN_FOR_MS &&
        !entry.stillFailingNotifiedAt
      ) {
        updated.stillFailingNotifiedAt = now().toISOString()
        await notifyStillFailing(change, updated)
      }
      kept.push(updated)
      logger.warn(
        { err, key: entry.key },
        `${def.name}: queued entry still failing, keeping in queue`
      )
    }
  }
  if (queueChanged) await writeQueue(queueFile, kept)

  // 2) Process new cmlog rows
  if (!result.ok) {
    logger.error({ err: result.err }, `${def.name}: failed to fetch changes`)
    throw new Error(result.err)
  }
  const changes = fetched
  logger.info({ count: changes.length }, 'changes to process')

  let queueForRun = kept
  let savedTimestamp = lastTimestamp
  const saveTimestamp = async (timestamp: Date) => {
    await saveLastTimestamp(stateFile, timestamp)
    savedTimestamp = timestamp
  }

  let succeeded = 0
  let skipped = 0
  let failed = 0
  for (const [index, change] of changes.entries()) {
    const key = def.keyFor(change)
    const existing = queueForRun.find((e) => e.key === key)
    try {
      const outcome = await def.sync(change)
      if (outcome) skipped++
      else succeeded++
      if (existing) {
        await removeEntry(queueFile, key)
        queueForRun = queueForRun.filter((e) => e.key !== key)
        await notifyResolved(change, existing, outcome)
      }
    } catch (err) {
      failed++
      const sameRow =
        existing !== undefined &&
        def.timestampOf(def.fromPayload(existing.payload)).getTime() ===
          def.timestampOf(change).getTime()
      if (sameRow) {
        const undoFailed = newUndoFailures(existing, err)
        if (undoFailed.length) {
          const marked = withUndoFailures(
            { ...existing, lastError: errorMessage(err) },
            undoFailed
          )
          queueForRun = queueForRun.map((e) => (e.key === key ? marked : e))
          await writeQueue(queueFile, queueForRun)
          await notifyUndoFailed(change, marked, undoFailed)
        }
        logger.warn(
          { err, key },
          `${def.name}: row failed but already in queue (crash-retry), skipping failure mail`
        )
      } else {
        const undoFailed = newUndoFailures(existing, err)
        const entry: FailedRowEntry = withUndoFailures(
          {
            key,
            type: def.entryType,
            payload: def.toPayload(change),
            addedAt: now().toISOString(),
            lastError: errorMessage(err),
            lastAttemptAt: now().toISOString(),
            ...(existing?.undoFailedIn && {
              undoFailedIn: existing.undoFailedIn,
            }),
          },
          undoFailed
        )
        if (existing) {
          queueForRun = [...queueForRun.filter((e) => e.key !== key), entry]
          await writeQueue(queueFile, queueForRun)
        } else {
          queueForRun = [...queueForRun, entry]
          await appendEntry(queueFile, entry)
        }
        await notifyFailure(change, entry)
        if (undoFailed.length) await notifyUndoFailed(change, entry, undoFailed)
        logger.error({ err, key }, `${def.name}: queued for retry, mail sent`)
      }
    }
    // cmlog has whole seconds: save only once a second is done, so a crash
    // mid-second re-reads the whole second instead of skipping its rest.
    const next = changes[index + 1]
    if (
      !next ||
      def.timestampOf(next).getTime() > def.timestampOf(change).getTime()
    )
      await saveTimestamp(def.timestampOf(change))
  }

  const newest =
    result.until ??
    (skipExisting
      ? result.data
          .map(def.timestampOf)
          .reduce<Date | undefined>(
            (max, t) => (max && max.getTime() >= t.getTime() ? max : t),
            undefined
          )
      : undefined)
  if (
    newest &&
    (!savedTimestamp || newest.getTime() > savedTimestamp.getTime())
  ) {
    await saveTimestamp(newest)
  }
  if (skipExisting && !savedTimestamp) await saveTimestamp(now())

  logger.info(
    { total: changes.length, succeeded, skipped, failed },
    `${def.name} run complete`
  )
}
