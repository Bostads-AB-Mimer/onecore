import { createHash } from 'crypto'

import { logger } from '@onecore/utilities'

import {
  appendEntry,
  readQueue,
  removeEntry,
  writeQueue,
  FailedRowEntry,
} from './failed-sync-queue'
import { readSyncPosition, saveSyncPosition } from './last-timestamp'
import { notifyXpandSync } from './notify'
import type { SyncStepsFailure } from '../../processes/sync-steps'

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
// Xpand stamps logtime before commit, so a row can show up this long after its logtime.
const LATE_COMMIT_MS = 5 * MINUTE_MS
const CLOCK_SKEW_MS = 5 * MINUTE_MS
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
  // Returns the changes logged after `since`, oldest first. `until` is the
  // newest cmlog row read, parsed or not; it is saved as the timestamp when it
  // is later than the last change.
  fetchChanges: (
    since: Date | null
  ) => Promise<
    { ok: true; data: T[]; until?: Date } | { ok: false; err: string }
  >
  sync: (change: T) => Promise<SyncOutcome>
  keyFor: (change: T) => string
  // Changes sharing a supersede key replace each other: only the newest is synced.
  supersedeKey?: (change: T) => string
  // Changes sharing an order key sync in queue order: a new one waits in the
  // queue, unsynced and unmailed, while an earlier one is queued.
  orderKey?: (change: T) => string
  timestampOf: (change: T) => Date
  toPayload: (change: T) => unknown
  // What the sync sends, when that is less than the payload; hashed to spot a re-read change.
  contentOf?: (change: T) => unknown
  fromPayload: (payload: unknown) => T
  describe: (change: T) => { subject: string; detail: string }
  giveUpAdvice?: string | ((change: T, entry: FailedRowEntry) => string)
}

const withSortedKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(withSortedKeys)
    : value && typeof value === 'object' && !(value instanceof Date)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [
              k,
              withSortedKeys((value as Record<string, unknown>)[k]),
            ])
        )
      : value

// Services collapse rows to one change per key and second, so a re-read row
// can share a key with a handled one and still carry new data.
export const handledIdOf = <T>(
  def: Pick<CmlogSync<T>, 'keyFor' | 'toPayload' | 'contentOf'>,
  change: T
) =>
  `${def.keyFor(change)}#${createHash('sha1')
    .update(
      JSON.stringify(withSortedKeys((def.contentOf ?? def.toPayload)(change)))
    )
    .digest('hex')
    .slice(0, 12)}`

const floorToSecond = (time: number) => Math.floor(time / SECOND_MS) * SECOND_MS

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

  const notifyGiveUp = (
    change: T,
    entry: FailedRowEntry,
    heldDetails: string[]
  ) => {
    const { subject, detail } = def.describe(change)
    const advice =
      typeof def.giveUpAdvice === 'function'
        ? def.giveUpAdvice(change, entry)
        : (def.giveUpAdvice ?? DEFAULT_GIVE_UP_ADVICE)
    return notifyXpandSync(`${def.name}: ger upp ${subject}`, [
      `${capitalize(detail)} har misslyckats sedan ${entry.addedAt}.`,
      `Senaste fel: ${entry.lastError}`,
      ...(entry.undoFailedIn?.length
        ? [
            `Ändringen kunde inte återställas i: ${entry.undoFailedIn.join(', ')}. Dessa system har kvar ändringen medan övriga inte har den.`,
          ]
        : []),
      ``,
      `Raden har tagits bort ur återförsökskön och försöks inte igen. ${advice}`,
      ...(heldDetails.length
        ? [
            ``,
            `Följande ändringar väntade på den här och har också tagits bort ur återförsökskön: ${heldDetails.join(', ')}.`,
          ]
        : []),
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

  const notifyHeldSkipped = (change: T, reason: string) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(`${def.name}: ${subject} synkades inte`, [
      `${capitalize(detail)} synkades inte: ${reason}.`,
      ``,
      `Raden väntade i återförsökskön på en tidigare ändring och har tagits bort därifrån.`,
    ])
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

  const position = await readSyncPosition(stateFile)
  const handled = new Map(position?.handled)
  let lastTimestamp = position?.timestamp ?? null
  let readFrom = position?.readFrom.getTime() ?? -Infinity
  const skipExisting = !position && def.firstRun === 'start-now'
  if (position) {
    logger.info(
      { lastTimestamp, readFrom: position.readFrom },
      'syncing since saved position'
    )
  } else if (skipExisting) {
    logger.info('no saved timestamp, starting from the newest row')
  } else {
    logger.info('no saved timestamp, syncing all')
  }
  const readAt = now().getTime()
  const result = await def.fetchChanges(
    position ? new Date(readFrom - SECOND_MS) : null
  )
  const ids = new Map<T, string>()
  const idOf = (change: T) => {
    const id = ids.get(change) ?? handledIdOf(def, change)
    ids.set(change, id)
    return id
  }
  const read = result.ok ? result.data : []
  const fetched = skipExisting ? [] : read.filter((c) => !handled.has(idOf(c)))

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

  const orderKeyOfEntry = (entry: FailedRowEntry) =>
    def.orderKey && entry.type === def.entryType
      ? def.orderKey(def.fromPayload(entry.payload))
      : undefined

  const kept: FailedRowEntry[] = []
  let queueChanged = false
  const droppedWithBlocker = new Set<string>()
  const blockedOrderKeys = new Set<string>()
  const blockedKeys = new Set<string>()
  for (const [index, entry] of queue.entries()) {
    if (entry.type !== def.entryType) {
      kept.push(entry)
      continue
    }
    const change = def.fromPayload(entry.payload)
    const orderKey = def.orderKey?.(change)
    const keep = (e: FailedRowEntry) => {
      kept.push(e)
      if (orderKey !== undefined) blockedOrderKeys.add(orderKey)
    }
    const handle = () => {
      queueChanged = true
      handled.set(idOf(change), def.timestampOf(change).getTime())
    }
    if (droppedWithBlocker.has(entry.key)) {
      handle()
      continue
    }
    if (isSuperseded(change)) {
      handle()
      logger.info(
        { key: entry.key },
        `${def.name}: queued entry replaced by a newer change, dropping`
      )
      if (!entry.heldBehind) await notifySuperseded(change, entry)
      continue
    }
    if (orderKey !== undefined && blockedOrderKeys.has(orderKey)) {
      blockedKeys.add(entry.key)
      keep(entry)
      continue
    }
    if (entry.heldBehind) {
      try {
        const outcome = await def.sync(change)
        handle()
        if (outcome) {
          await notifyHeldSkipped(change, outcome.skipped)
          logger.warn(
            { key: entry.key, reason: outcome.skipped },
            `${def.name}: held entry skipped once released, mail sent`
          )
        } else {
          logger.info(
            { key: entry.key },
            `${def.name}: held entry synced after the change it waited for`
          )
        }
      } catch (err) {
        queueChanged = true
        const failed: FailedRowEntry = {
          key: entry.key,
          type: entry.type,
          payload: entry.payload,
          addedAt: now().toISOString(),
          lastError: errorMessage(err),
          lastAttemptAt: now().toISOString(),
        }
        keep(failed)
        await notifyFailure(change, failed)
        logger.error(
          { err, key: entry.key },
          `${def.name}: held entry failed once released, queued for retry, mail sent`
        )
      }
      continue
    }
    const retriesStartedAt =
      entry.retriesStartedAt ??
      (entry.lastAttemptAt ? entry.addedAt : now().toISOString())
    const failingFor = now().getTime() - new Date(retriesStartedAt).getTime()
    const sinceLastAttempt =
      now().getTime() - new Date(entry.lastAttemptAt ?? entry.addedAt).getTime()
    if (sinceLastAttempt < retryIntervalFor(failingFor)) {
      keep(entry)
      continue
    }
    queueChanged = true
    try {
      const outcome = await def.sync(change)
      handle()
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
        handle()
        const held = queue
          .slice(index + 1)
          .filter((e) => e.heldBehind && orderKeyOfEntry(e) === orderKey)
        held.forEach((e) => droppedWithBlocker.add(e.key))
        await notifyGiveUp(
          change,
          updated,
          held.map((e) => def.describe(def.fromPayload(e.payload)).detail)
        )
        logger.error(
          { err, key: entry.key, dropped: held.map((e) => e.key) },
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
      keep(updated)
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
  const changes = fetched.filter((c) => !handled.has(idOf(c)))
  logger.info({ count: changes.length }, 'changes to process')

  let queueForRun = kept
  const savePosition = async (earliestUnseen: number) => {
    readFrom = Math.max(readFrom, floorToSecond(earliestUnseen))
    for (const [id, at] of handled) if (at < readFrom) handled.delete(id)
    await saveSyncPosition(stateFile, {
      timestamp: lastTimestamp,
      readFrom: new Date(readFrom),
      handled,
    })
  }
  const moveLastTimestamp = (timestamp: Date) => {
    if (!lastTimestamp || timestamp.getTime() > lastTimestamp.getTime())
      lastTimestamp = timestamp
  }

  const latestByOrderKey = new Map<string, FailedRowEntry>()
  for (const entry of queueForRun) {
    const orderKey = orderKeyOfEntry(entry)
    if (orderKey !== undefined) latestByOrderKey.set(orderKey, entry)
  }
  const trackQueued = (entry: FailedRowEntry) => {
    const orderKey = orderKeyOfEntry(entry)
    if (orderKey !== undefined) latestByOrderKey.set(orderKey, entry)
  }
  const trackRemoved = (entry: FailedRowEntry) => {
    const orderKey = orderKeyOfEntry(entry)
    if (orderKey === undefined || latestByOrderKey.get(orderKey) !== entry)
      return
    const previous = [...queueForRun]
      .reverse()
      .find((e) => orderKeyOfEntry(e) === orderKey)
    if (previous) latestByOrderKey.set(orderKey, previous)
    else latestByOrderKey.delete(orderKey)
  }
  const blockerOf = (change: T) =>
    def.orderKey ? latestByOrderKey.get(def.orderKey(change)) : undefined

  let succeeded = 0
  let skipped = 0
  let failed = 0
  let held = 0

  const hold = async (change: T, key: string, blocker: FailedRowEntry) => {
    const entry: FailedRowEntry = {
      key,
      type: def.entryType,
      payload: def.toPayload(change),
      addedAt: now().toISOString(),
      lastError: `Väntar på ${def.describe(def.fromPayload(blocker.payload)).detail}`,
      heldBehind: blocker.key,
    }
    queueForRun = [...queueForRun, entry]
    trackQueued(entry)
    await appendEntry(queueFile, entry)
    logger.info(
      { key, heldBehind: blocker.key },
      `${def.name}: held behind a queued change`
    )
  }

  const syncRow = async (
    change: T,
    key: string,
    existing: FailedRowEntry | undefined
  ) => {
    try {
      const outcome = await def.sync(change)
      if (outcome) skipped++
      else succeeded++
      if (existing) {
        await removeEntry(queueFile, key)
        queueForRun = queueForRun.filter((e) => e.key !== key)
        trackRemoved(existing)
        await notifyResolved(change, existing, outcome)
      }
    } catch (err) {
      failed++
      const sameRow =
        existing !== undefined &&
        handledIdOf(def, def.fromPayload(existing.payload)) === idOf(change)
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
          queueForRun = queueForRun.map((e) => (e.key === key ? entry : e))
          await writeQueue(queueFile, queueForRun)
        } else {
          queueForRun = [...queueForRun, entry]
          await appendEntry(queueFile, entry)
        }
        trackQueued(entry)
        await notifyFailure(change, entry)
        if (undoFailed.length) await notifyUndoFailed(change, entry, undoFailed)
        logger.error({ err, key }, `${def.name}: queued for retry, mail sent`)
      }
    }
  }

  for (const [index, change] of changes.entries()) {
    const key = def.keyFor(change)
    const existing = queueForRun.find((e) => e.key === key)
    const blocker = existing ? undefined : blockerOf(change)
    if (existing?.heldBehind || blockedKeys.has(key) || blocker) {
      held++
      if (blocker) await hold(change, key, blocker)
    } else {
      await syncRow(change, key, existing)
    }
    const time = def.timestampOf(change)
    handled.set(idOf(change), time.getTime())
    // The timestamp file moves only once a second is done; older code reads it.
    const next = changes[index + 1]
    if (!next || def.timestampOf(next).getTime() > time.getTime())
      moveLastTimestamp(time)
    await savePosition(time.getTime() - LATE_COMMIT_MS)
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
  if (newest) moveLastTimestamp(newest)
  if (skipExisting) {
    for (const change of read)
      handled.set(idOf(change), def.timestampOf(change).getTime())
    if (!lastTimestamp) lastTimestamp = now()
  }
  await savePosition(
    Math.max(
      lastTimestamp ? lastTimestamp.getTime() - LATE_COMMIT_MS : -Infinity,
      readAt - LATE_COMMIT_MS - CLOCK_SKEW_MS
    )
  )

  logger.info(
    { total: changes.length, succeeded, skipped, failed, held },
    `${def.name} run complete`
  )
}
