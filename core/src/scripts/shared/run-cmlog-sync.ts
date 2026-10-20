import { logger } from '@onecore/utilities'

import {
  readQueue,
  removeEntry,
  upsertEntry,
  FailedRowEntry,
} from './failed-sync-queue'
import { getLastTimestamp, saveLastTimestamp } from './last-timestamp'
import { notifyXpandSync } from './notify'

export class PermanentSyncError extends Error {}

const HOUR_MS = 60 * 60 * 1000
const RETRY_EVERY_RUN_FOR_MS = 24 * HOUR_MS
const SLOW_RETRY_INTERVAL_MS = 6 * HOUR_MS
const GIVE_UP_AFTER_MS = 7 * 24 * HOUR_MS

export type CmlogSync<T> = {
  name: string
  entryType: FailedRowEntry['type']
  fetchChanges: (
    since: Date | null
  ) => Promise<{ ok: true; data: T[] } | { ok: false; err: string }>
  sync: (change: T) => Promise<void>
  keyFor: (change: T) => string
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
      new Date(entry.addedAt).getTime() + GIVE_UP_AFTER_MS
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

  const notifyPermanent = (change: T, err: unknown) => {
    const { subject, detail } = def.describe(change)
    return notifyXpandSync(`${def.name}: ${subject} kan inte synkas`, [
      `Misslyckades på ${detail} vid ${def.timestampOf(change).toISOString()}.`,
      `Fel: ${errorMessage(err)}`,
      ``,
      `Felet går inte över av sig självt, så raden läggs inte i återförsökskön.`,
    ])
  }

  // 1) Drain queue first
  const queue = await readQueue(queueFile)
  logger.info({ queueDepth: queue.length }, 'draining failure queue')
  for (const entry of queue) {
    if (entry.type !== def.entryType) continue
    const failingFor = now().getTime() - new Date(entry.addedAt).getTime()
    const sinceLastAttempt =
      now().getTime() - new Date(entry.lastAttemptAt ?? entry.addedAt).getTime()
    if (
      failingFor >= RETRY_EVERY_RUN_FOR_MS &&
      sinceLastAttempt < SLOW_RETRY_INTERVAL_MS
    )
      continue
    const change = def.fromPayload(entry.payload)
    try {
      await def.sync(change)
      await removeEntry(queueFile, entry.key)
      await notifyRecovery(change, entry)
    } catch (err) {
      if (err instanceof PermanentSyncError) {
        await removeEntry(queueFile, entry.key)
        await notifyPermanent(change, err)
        continue
      }
      const updated: FailedRowEntry = {
        ...entry,
        lastAttemptAt: now().toISOString(),
        lastError: errorMessage(err),
      }
      if (failingFor >= GIVE_UP_AFTER_MS) {
        await removeEntry(queueFile, entry.key)
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
      await upsertEntry(queueFile, updated)
      logger.warn(
        { err, key: entry.key },
        `${def.name}: queued entry still failing, keeping in queue`
      )
    }
  }

  // 2) Process new cmlog rows
  const lastTimestamp = await getLastTimestamp(stateFile)
  if (lastTimestamp) {
    logger.info({ lastTimestamp }, 'syncing since last timestamp')
  } else {
    logger.info('no saved timestamp, syncing all')
  }
  const result = await def.fetchChanges(lastTimestamp)
  if (!result.ok) {
    logger.error({ err: result.err }, `${def.name}: failed to fetch changes`)
    throw new Error(result.err)
  }
  const changes = result.data
  logger.info({ count: changes.length }, 'changes to process')

  let queueForRun = await readQueue(queueFile)
  const forget = async (key: string) => {
    await removeEntry(queueFile, key)
    queueForRun = queueForRun.filter((e) => e.key !== key)
  }

  let succeeded = 0
  let failed = 0
  for (const change of changes) {
    const key = def.keyFor(change)
    const existing = queueForRun.find((e) => e.key === key)
    try {
      await def.sync(change)
      succeeded++
      if (existing) {
        await forget(key)
        await notifyRecovery(change, existing)
      }
    } catch (err) {
      failed++
      if (err instanceof PermanentSyncError) {
        if (existing) await forget(key)
        await notifyPermanent(change, err)
      } else {
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
            { key },
            `${def.name}: row failed but already in queue (crash-retry), skipping mail`
          )
        } else {
          await upsertEntry(queueFile, entry)
          queueForRun = [...queueForRun.filter((e) => e.key !== key), entry]
          await notifyFailure(change, entry)
          logger.error({ err, key }, `${def.name}: queued for retry, mail sent`)
        }
      }
    }
    await saveLastTimestamp(stateFile, def.timestampOf(change))
  }

  logger.info(
    { total: changes.length, succeeded, failed },
    `${def.name} run complete`
  )
}
