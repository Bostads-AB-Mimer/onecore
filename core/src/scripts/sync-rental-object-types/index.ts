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
import { getLastTimestamp, saveLastTimestamp } from '../shared/last-timestamp'
import { notifyXpandSync as notify } from '../shared/notify'

const DEFAULT_STATE_FILE = '/data/last-timestamp-rental-object-types.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'
const OVERLAP_MS = 2 * 60 * 60 * 1000
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000

const seenFileFor = (stateFile: string) => `${stateFile}.seen.json`

const getSeen = async (stateFile: string): Promise<Map<string, Date>> => {
  try {
    const content = JSON.parse(
      await fs.readFile(seenFileFor(stateFile), 'utf-8')
    ) as Record<string, string>
    return new Map(
      Object.entries(content).map(([key, ts]) => [key, new Date(ts)])
    )
  } catch {
    return new Map()
  }
}

const saveSeen = async (
  stateFile: string,
  seen: Map<string, Date>,
  checkpoint: Date
) => {
  const windowStart = checkpoint.getTime() - OVERLAP_MS
  const file = seenFileFor(stateFile)
  const tmp = `${file}.tmp`
  await fs.writeFile(
    tmp,
    JSON.stringify(
      Object.fromEntries(
        Array.from(seen)
          .filter(([, ts]) => ts.getTime() >= windowStart)
          .map(([key, ts]) => [key, ts.toISOString()])
      )
    ),
    'utf-8'
  )
  await fs.rename(tmp, file)
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

type SyncOutcome = 'succeeded' | 'unknownType' | 'rejected' | 'failed'

const syncChange = async (
  change: RentalObjectTypeChange,
  existing: FailedRowEntry | undefined,
  queue: {
    remove: (key: string) => Promise<void>
    upsert: (entry: FailedRowEntry) => Promise<void>
  },
  now: Date
): Promise<SyncOutcome> => {
  const key = keyFor(change.rentalObjectCode)
  const result = await syncRentalObjectType(
    change.rentalObjectCode,
    change.code
  )

  if (result.ok) {
    await queue.remove(key)
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
    return 'succeeded'
  }

  if (result.err === 'unknown-type') {
    await queue.remove(key)
    await notifyUnknownType(change)
    return 'unknownType'
  }

  if (result.err === 'rejected') {
    await queue.remove(key)
    await notifyRejected(change)
    return 'rejected'
  }

  const alreadyQueued =
    existing !== undefined &&
    reviveChange(existing.payload).timestamp.getTime() ===
      change.timestamp.getTime()
  const entry: FailedRowEntry = {
    key,
    type: 'rental-object-type',
    payload: { ...change, timestamp: change.timestamp.toISOString() },
    addedAt: alreadyQueued && existing ? existing.addedAt : now.toISOString(),
    lastError: `${result.err} (status ${result.statusCode ?? 'none'})`,
  }

  if (
    alreadyQueued &&
    now.getTime() - new Date(entry.addedAt).getTime() >= GIVE_UP_AFTER_MS
  ) {
    await queue.remove(key)
    await notifyGiveUp(entry)
    logger.error(
      { key, err: result.err },
      'sync-rental-object-types: queued entry failed for a day, giving up'
    )
    return 'failed'
  }

  await queue.upsert(entry)
  if (alreadyQueued) {
    logger.warn(
      { key, err: result.err },
      'sync-rental-object-types: queued entry still failing, keeping in queue'
    )
  } else {
    await notifyFailure(entry)
    logger.error(
      { err: result.err, rentalObjectCode: change.rentalObjectCode },
      'sync-rental-object-types: queued for retry, mail sent'
    )
  }
  return 'failed'
}

export const syncRentalObjectTypes = async (
  opts: { stateFile?: string; queueFile?: string; now?: () => Date } = {}
) => {
  const stateFile = opts.stateFile ?? DEFAULT_STATE_FILE
  const queueFile = opts.queueFile ?? DEFAULT_QUEUE_FILE
  const now = opts.now ?? (() => new Date())

  const lastTimestamp = await getLastTimestamp(stateFile)
  if (!lastTimestamp) {
    const startFrom = toXpandTime(now())
    await saveLastTimestamp(stateFile, startFrom)
    logger.info({ startFrom }, 'no saved timestamp, starting from now')
    return
  }

  const since = new Date(lastTimestamp.getTime() - OVERLAP_MS)
  logger.info(
    { lastTimestamp, since },
    'syncing rental object types since last timestamp'
  )
  const changesResult = await getRentalObjectTypeChanges(since)
  if (!changesResult.ok) {
    logger.error(
      { err: changesResult.err },
      'Failed to fetch rental object type changes'
    )
    throw new Error(changesResult.err)
  }
  const seen = await getSeen(stateFile)
  const unseen = changesResult.data.filter(
    (change) => !seen.has(eventKey(change))
  )
  const changes = latestPerRentalObject(unseen)
  const changedCodes = new Set(changes.map((c) => c.rentalObjectCode))

  let queue = await readQueue(queueFile)
  const queueOps = {
    remove: async (key: string) => {
      if (!queue.some((e) => e.key === key)) return
      queue = queue.filter((e) => e.key !== key)
      await writeQueue(queueFile, queue)
    },
    upsert: async (entry: FailedRowEntry) => {
      queue = [...queue.filter((e) => e.key !== entry.key), entry]
      await writeQueue(queueFile, queue)
    },
  }

  // 1) Drain queue, except entries a new change replaces
  const toRetry = queue.filter(
    (entry) =>
      entry.type === 'rental-object-type' &&
      !changedCodes.has(reviveChange(entry.payload).rentalObjectCode)
  )
  logger.info({ queueDepth: toRetry.length }, 'draining failure queue')
  for (const entry of toRetry) {
    await syncChange(reviveChange(entry.payload), entry, queueOps, now())
  }

  // 2) Process new cmlog rows, latest per rental object
  logger.info(
    { count: changes.length },
    'rental object type changes to process'
  )
  const counts = { succeeded: 0, failed: 0, unknownType: 0, rejected: 0 }
  let checkpoint = lastTimestamp
  for (const change of changes) {
    const existing = queue.find(
      (e) => e.key === keyFor(change.rentalObjectCode)
    )
    counts[await syncChange(change, existing, queueOps, now())]++

    for (const handled of unseen) {
      if (handled.rentalObjectCode !== change.rentalObjectCode) continue
      seen.set(eventKey(handled), handled.timestamp)
      if (handled.timestamp.getTime() > checkpoint.getTime())
        checkpoint = handled.timestamp
    }
    await saveSeen(stateFile, seen, checkpoint)
    await saveLastTimestamp(stateFile, checkpoint)
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
