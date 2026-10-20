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

const HOUR_MS = 60 * 60 * 1000
const RETRY_EVERY_RUN_FOR_MS = 24 * HOUR_MS
const SLOW_RETRY_INTERVAL_MS = 6 * HOUR_MS
const GIVE_UP_AFTER_MS = 7 * 24 * HOUR_MS

export type SyncOutcome = void | { skipped: string }

export type CmlogSync<T> = {
  name: string
  entryType: FailedRowEntry['type']
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
      `Raden ligger nu i återförsökskön på PVC (/data/failed-rows.jsonl). Den försöks igen varje minut i ett dygn och sedan var sjätte timme i en vecka. Du får ett bekräftelsemail när den lyckas synkas.`,
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
      `Raden försöks nu igen var sjätte timme till ${giveUpAt}, och tas sedan bort ur återförsökskön.`,
    ])
  }

  const notifyGiveUp = (change: T, entry: FailedRowEntry) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(`${def.name}: ger upp ${subject}`, [
      `${capitalize(detail)} har misslyckats sedan ${entry.addedAt}.`,
      `Senaste fel: ${entry.lastError}`,
      ``,
      `Raden har tagits bort ur återförsökskön och försöks inte igen. Gör ändringen i Xpand på nytt för att försöka igen.`,
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
  if (lastTimestamp) {
    logger.info({ lastTimestamp }, 'syncing since last timestamp')
  } else {
    logger.info('no saved timestamp, syncing all')
  }
  const result = await def.fetchChanges(lastTimestamp)

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
      ...(result.ok ? result.data : []),
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
    if (
      failingFor >= RETRY_EVERY_RUN_FOR_MS &&
      sinceLastAttempt < SLOW_RETRY_INTERVAL_MS
    ) {
      kept.push(entry)
      continue
    }
    queueChanged = true
    try {
      const outcome = await def.sync(change)
      await notifyResolved(change, entry, outcome)
    } catch (err) {
      const updated: FailedRowEntry = {
        ...entry,
        ...(retriesStartedAt !== entry.addedAt && { retriesStartedAt }),
        lastAttemptAt: now().toISOString(),
        lastError: errorMessage(err),
      }
      if (failingFor >= GIVE_UP_AFTER_MS) {
        await notifyGiveUp(change, updated)
        logger.error(
          { err, key: entry.key },
          `${def.name}: queued entry failed for a week, giving up`
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
  const changes = result.data
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
  for (const change of changes) {
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
      const entry: FailedRowEntry = {
        key,
        type: def.entryType,
        payload: def.toPayload(change),
        addedAt: now().toISOString(),
        lastError: errorMessage(err),
        lastAttemptAt: now().toISOString(),
      }
      const sameRow =
        existing !== undefined &&
        def.timestampOf(def.fromPayload(existing.payload)).getTime() ===
          def.timestampOf(change).getTime()
      if (sameRow) {
        logger.warn(
          { err, key },
          `${def.name}: row failed but already in queue (crash-retry), skipping mail`
        )
      } else {
        if (existing) {
          queueForRun = [...queueForRun.filter((e) => e.key !== key), entry]
          await writeQueue(queueFile, queueForRun)
        } else {
          queueForRun = [...queueForRun, entry]
          await appendEntry(queueFile, entry)
        }
        await notifyFailure(change, entry)
        logger.error({ err, key }, `${def.name}: queued for retry, mail sent`)
      }
    }
    await saveTimestamp(def.timestampOf(change))
  }

  if (
    result.until &&
    (!savedTimestamp || result.until.getTime() > savedTimestamp.getTime())
  ) {
    await saveTimestamp(result.until)
  }

  logger.info(
    { total: changes.length, succeeded, skipped, failed },
    `${def.name} run complete`
  )
}
