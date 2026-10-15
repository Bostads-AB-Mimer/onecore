import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import type { RentalObjectTypeChange } from '@onecore/types'
import {
  getRentalObjectTypeChanges,
  syncRentalObjectType,
} from '../../adapters/leasing-adapter'
import {
  readQueue,
  writeQueue,
  FailedRowEntry,
} from '../shared/failed-sync-queue'
import { notifyXpandSync as notify } from '../shared/notify'

const DEFAULT_STATE_FILE = '/data/sync-rental-object-types-state.json'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'
const OVERLAP_MS = 2 * 60 * 60 * 1000
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000

type SyncState = {
  checkpoint: Date
  seen: Map<string, Date>
}

const readState = async (stateFile: string): Promise<SyncState | null> => {
  try {
    const content = JSON.parse(await fs.readFile(stateFile, 'utf-8')) as {
      checkpoint: string
      seen: Record<string, string>
    }
    const checkpoint = new Date(content.checkpoint)
    if (isNaN(checkpoint.getTime())) return null
    return {
      checkpoint,
      seen: new Map(
        Object.entries(content.seen ?? {}).map(([key, ts]) => [
          key,
          new Date(ts),
        ])
      ),
    }
  } catch {
    return null
  }
}

const saveState = async (stateFile: string, state: SyncState) => {
  const windowStart = state.checkpoint.getTime() - OVERLAP_MS
  const seen = Object.fromEntries(
    Array.from(state.seen)
      .filter(([, ts]) => ts.getTime() >= windowStart)
      .map(([key, ts]) => [key, ts.toISOString()])
  )
  const tmp = `${stateFile}.tmp`
  await fs.writeFile(
    tmp,
    JSON.stringify({ checkpoint: state.checkpoint.toISOString(), seen }),
    'utf-8'
  )
  await fs.rename(tmp, stateFile)
}

// cmlog.logtime is Swedish wall-clock time that the mssql driver reads as UTC.
const toXpandTime = (date: Date): Date => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Stockholm',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, Number(value)])
  )
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      date.getUTCMilliseconds()
    )
  )
}

const formatXpandTime = (date: Date): string =>
  date.toISOString().slice(0, 19).replace('T', ' ')

const eventKey = (change: RentalObjectTypeChange): string =>
  `${change.rentalObjectCode}|${change.timestamp.toISOString()}|${change.code ?? ''}`

const keyFor = (rentalObjectCode: string): string =>
  `rental-object-type:${rentalObjectCode}`

const reviveChange = (payload: unknown): RentalObjectTypeChange => {
  const p = payload as Omit<RentalObjectTypeChange, 'timestamp'> & {
    timestamp: string | Date
  }
  return { ...p, timestamp: new Date(p.timestamp) }
}

const latestPerRentalObject = (
  changes: RentalObjectTypeChange[]
): RentalObjectTypeChange[] => {
  const latest = new Map<string, RentalObjectTypeChange>()
  for (const change of changes) {
    // Delete before set so the Map keeps insertion order by latest change.
    latest.delete(change.rentalObjectCode)
    latest.set(change.rentalObjectCode, change)
  }
  return Array.from(latest.values())
}

const quotedCode = (change: RentalObjectTypeChange): string =>
  `'${change.code ?? ''}'`

const notifyFailure = (entry: FailedRowEntry) => {
  const change = reviveChange(entry.payload)
  return notify(
    `sync-rental-object-types: nytt fel på hyresobjekt ${change.rentalObjectCode}`,
    [
      `Kunde inte sätta hyresobjektstyp ${quotedCode(change)} på hyresobjekt ${change.rentalObjectCode} i Tenfast (ändrad i Xpand ${formatXpandTime(change.timestamp)}).`,
      `Fel: ${entry.lastError}`,
      ``,
      `Raden ligger nu i återförsökskön på PVC (/data/failed-rows.jsonl) och försöks igen vid nästa körning. Du får ett mail när den lyckas synkas, eller om den fortfarande misslyckas efter ett dygn.`,
    ]
  )
}

const notifyRecovery = (
  entry: FailedRowEntry,
  change: RentalObjectTypeChange
) =>
  notify(
    `sync-rental-object-types: tidigare felande hyresobjekt ${change.rentalObjectCode} är nu synkat`,
    [
      `Hyresobjekt ${change.rentalObjectCode} har nu hyresobjektstyp ${quotedCode(change)} i Tenfast.`,
      `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
    ]
  )

const notifyMissing = (change: RentalObjectTypeChange) =>
  notify(
    `sync-rental-object-types: hyresobjekt ${change.rentalObjectCode} finns inte i Tenfast`,
    [
      `Hyresobjekt ${change.rentalObjectCode} skulle få hyresobjektstyp ${quotedCode(change)} (ändrad i Xpand ${formatXpandTime(change.timestamp)}), men finns inte i Tenfast.`,
      `Ingenting har ändrats i Tenfast och raden har tagits bort ur återförsökskön.`,
    ]
  )

const notifyUnknownType = (change: RentalObjectTypeChange) =>
  notify(
    `sync-rental-object-types: okänd hyresobjektstyp ${quotedCode(change)} på hyresobjekt ${change.rentalObjectCode}`,
    [
      `Hyresobjekt ${change.rentalObjectCode} fick hyresobjektstyp ${quotedCode(change)} i Xpand (${formatXpandTime(change.timestamp)}), men Tenfast har ingen sådan typ.`,
      `Ingenting har ändrats i Tenfast.`,
      ``,
      `Om Tenfast ska få typen behöver den läggas till i TENFAST_RENTAL_OBJECT_CATEGORIES i leasing-tjänsten.`,
    ]
  )

const notifyRejected = (change: RentalObjectTypeChange) =>
  notify(
    `sync-rental-object-types: Tenfast avvisade hyresobjekt ${change.rentalObjectCode}`,
    [
      `Tenfast avvisade hyresobjektstyp ${quotedCode(change)} på hyresobjekt ${change.rentalObjectCode} (ändrad i Xpand ${formatXpandTime(change.timestamp)}).`,
      `Ingenting har ändrats i Tenfast och ändringen försöks inte igen. Kontrollera hyresobjektet i Tenfast och ändra typen i Xpand på nytt när det är rättat.`,
    ]
  )

const notifyGiveUp = (entry: FailedRowEntry) => {
  const change = reviveChange(entry.payload)
  return notify(
    `sync-rental-object-types: ger upp hyresobjekt ${change.rentalObjectCode}`,
    [
      `Hyresobjektstyp ${quotedCode(change)} på hyresobjekt ${change.rentalObjectCode} har inte gått att synka till Tenfast sedan ${entry.addedAt}.`,
      `Senaste fel: ${entry.lastError}`,
      ``,
      `Raden har tagits bort ur återförsökskön. Ändra typen i Xpand på nytt för att försöka igen.`,
    ]
  )
}

export const syncRentalObjectTypes = async (
  opts: { stateFile?: string; queueFile?: string; now?: () => Date } = {}
) => {
  const stateFile = opts.stateFile ?? DEFAULT_STATE_FILE
  const queueFile = opts.queueFile ?? DEFAULT_QUEUE_FILE
  const now = opts.now ?? (() => new Date())

  const state = await readState(stateFile)
  if (!state) {
    const startFrom = toXpandTime(now())
    await saveState(stateFile, { checkpoint: startFrom, seen: new Map() })
    logger.info(
      { startFrom },
      'sync-rental-object-types: no saved state, starting from now'
    )
    return
  }

  const since = new Date(state.checkpoint.getTime() - OVERLAP_MS)
  logger.info(
    { checkpoint: state.checkpoint, since },
    'syncing rental object types since checkpoint minus overlap'
  )
  const changesResult = await getRentalObjectTypeChanges(since)
  if (!changesResult.ok) {
    logger.error(
      { err: changesResult.err },
      'Failed to fetch rental object type changes'
    )
    throw new Error(changesResult.err)
  }
  const unseen = changesResult.data.filter(
    (change) => !state.seen.has(eventKey(change))
  )
  const changes = latestPerRentalObject(unseen)
  const changedCodes = new Set(changes.map((c) => c.rentalObjectCode))

  let queue = await readQueue(queueFile)
  const removeFromQueue = async (key: string) => {
    if (!queue.some((e) => e.key === key)) return
    queue = queue.filter((e) => e.key !== key)
    await writeQueue(queueFile, queue)
  }

  // 1) Retry queued entries that no new change replaces
  const toRetry = queue.filter(
    (entry) =>
      entry.type === 'rental-object-type' &&
      !changedCodes.has(reviveChange(entry.payload).rentalObjectCode)
  )
  logger.info({ queueDepth: toRetry.length }, 'draining failure queue')
  for (const entry of toRetry) {
    const change = reviveChange(entry.payload)
    const result = await syncRentalObjectType(
      change.rentalObjectCode,
      change.code
    )
    if (result.ok) {
      await removeFromQueue(entry.key)
      if (result.data.action === 'skipped') await notifyMissing(change)
      else await notifyRecovery(entry, change)
    } else if (result.err === 'unknown-type') {
      await removeFromQueue(entry.key)
      await notifyUnknownType(change)
    } else if (result.err === 'rejected') {
      await removeFromQueue(entry.key)
      await notifyRejected(change)
    } else if (
      now().getTime() - new Date(entry.addedAt).getTime() >=
      GIVE_UP_AFTER_MS
    ) {
      await removeFromQueue(entry.key)
      await notifyGiveUp(entry)
      logger.error(
        { key: entry.key, err: result.err },
        'sync-rental-object-types: queued entry failed for a day, giving up'
      )
    } else {
      logger.warn(
        { key: entry.key, err: result.err },
        'sync-rental-object-types: queued entry still failing, keeping in queue'
      )
    }
  }

  // 2) Sync new changes, latest per rental object
  logger.info({ count: changes.length }, 'rental object type changes to sync')
  const counts = {
    synced: 0,
    skipped: 0,
    unknownType: 0,
    rejected: 0,
    failed: 0,
  }
  for (const change of changes) {
    const key = keyFor(change.rentalObjectCode)
    const existing = queue.find((e) => e.key === key)
    const result = await syncRentalObjectType(
      change.rentalObjectCode,
      change.code
    )

    if (result.ok) {
      if (result.data.action === 'skipped') counts.skipped++
      else counts.synced++
      await removeFromQueue(key)
      if (existing && result.data.action === 'skipped')
        await notifyMissing(change)
      else if (existing) await notifyRecovery(existing, change)
      logger.info(
        {
          rentalObjectCode: change.rentalObjectCode,
          code: change.code,
          action: result.data.action,
        },
        'rental object type synced'
      )
    } else if (result.err === 'unknown-type') {
      counts.unknownType++
      await removeFromQueue(key)
      await notifyUnknownType(change)
    } else if (result.err === 'rejected') {
      counts.rejected++
      await removeFromQueue(key)
      await notifyRejected(change)
    } else {
      counts.failed++
      const isCrashRetry =
        existing !== undefined &&
        reviveChange(existing.payload).timestamp.getTime() ===
          change.timestamp.getTime()
      const entry: FailedRowEntry = {
        key,
        type: 'rental-object-type',
        payload: { ...change, timestamp: change.timestamp.toISOString() },
        addedAt:
          isCrashRetry && existing ? existing.addedAt : now().toISOString(),
        lastError: `${result.err} (status ${result.statusCode ?? 'none'})`,
      }
      queue = [...queue.filter((e) => e.key !== key), entry]
      await writeQueue(queueFile, queue)
      if (isCrashRetry) {
        logger.warn(
          { key },
          'sync-rental-object-types: row failed but already in queue (crash-retry), skipping mail'
        )
      } else {
        await notifyFailure(entry)
        logger.error(
          { err: result.err, rentalObjectCode: change.rentalObjectCode },
          'sync-rental-object-types: queued for retry, mail sent'
        )
      }
    }

    for (const handled of unseen) {
      if (handled.rentalObjectCode !== change.rentalObjectCode) continue
      state.seen.set(eventKey(handled), handled.timestamp)
      if (handled.timestamp.getTime() > state.checkpoint.getTime())
        state.checkpoint = handled.timestamp
    }
    await saveState(stateFile, state)
  }

  logger.info(
    { total: changes.length, ...counts },
    'sync-rental-object-types run complete'
  )
}

if (require.main === module) {
  syncRentalObjectTypes().catch((err) => {
    logger.error({ err }, 'sync-rental-object-types script failed')
    process.exitCode = 1
  })
}
