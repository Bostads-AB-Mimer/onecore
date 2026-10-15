import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import type { RentalObjectTypeChange } from '@onecore/types'
import config from '../../common/config'
import { sendEmail } from '../../adapters/communication-adapter'
import {
  getRentalObjectTypeChanges,
  syncRentalObjectType,
} from '../../adapters/leasing-adapter'
import {
  readQueue,
  removeEntry,
  upsertEntry,
  FailedRowEntry,
} from '../shared/failed-sync-queue'

const DEFAULT_STATE_FILE = '/data/last-timestamp-rental-object-types.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

const getLastTimestamp = async (stateFile: string): Promise<Date | null> => {
  try {
    const content = await fs.readFile(stateFile, 'utf-8')
    const trimmed = content.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const saveLastTimestamp = async (stateFile: string, ts: Date) => {
  const tmp = `${stateFile}.tmp`
  await fs.writeFile(tmp, ts.toISOString(), 'utf-8')
  await fs.rename(tmp, stateFile)
}

const handledFileFor = (stateFile: string) => `${stateFile}.handled.json`

const getHandledAtCheckpoint = async (
  stateFile: string,
  checkpoint: Date
): Promise<Set<string>> => {
  try {
    const content = await fs.readFile(handledFileFor(stateFile), 'utf-8')
    const handled = JSON.parse(content) as {
      timestamp: string
      rentalObjectCodes: string[]
    }
    return handled.timestamp === checkpoint.toISOString()
      ? new Set(handled.rentalObjectCodes)
      : new Set()
  } catch {
    return new Set()
  }
}

const saveHandledAtCheckpoint = async (
  stateFile: string,
  checkpoint: Date,
  rentalObjectCodes: Set<string>
) => {
  const file = handledFileFor(stateFile)
  const tmp = `${file}.tmp`
  await fs.writeFile(
    tmp,
    JSON.stringify({
      timestamp: checkpoint.toISOString(),
      rentalObjectCodes: Array.from(rentalObjectCodes),
    }),
    'utf-8'
  )
  await fs.rename(tmp, file)
}

const keyFor = (rentalObjectCode: string): string =>
  `rental-object-type:${rentalObjectCode}`

const reviveChange = (payload: unknown): RentalObjectTypeChange => {
  const p = payload as Omit<RentalObjectTypeChange, 'timestamp'> & {
    timestamp: string | Date
  }
  return { ...p, timestamp: new Date(p.timestamp) }
}

const quotedCode = (change: RentalObjectTypeChange): string =>
  `'${change.code ?? ''}'`

const notify = async (subject: string, body: string[]) => {
  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      'config.emailAddresses.xpandSync is not set — skipping notification'
    )
    return
  }
  try {
    await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject,
      body: body.join('\n'),
    })
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send notification')
  }
}

const notifyFailure = (entry: FailedRowEntry) => {
  const change = reviveChange(entry.payload)
  return notify(
    `sync-rental-object-types: nytt fel på hyresobjekt ${change.rentalObjectCode}`,
    [
      `Kunde inte sätta hyresobjektstyp ${quotedCode(change)} på hyresobjekt ${change.rentalObjectCode} i Tenfast (ändrad i Xpand ${change.timestamp.toISOString()}).`,
      `Fel: ${entry.lastError}`,
      ``,
      `Raden ligger nu i återförsökskön på PVC (/data/failed-rows.jsonl) och kommer att försökas igen vid nästa körning. Du får ett bekräftelsemail när den lyckas synkas.`,
    ]
  )
}

const notifyRecovery = (entry: FailedRowEntry) => {
  const change = reviveChange(entry.payload)
  return notify(
    `sync-rental-object-types: tidigare felande hyresobjekt ${change.rentalObjectCode} är nu synkat`,
    [
      `Hyresobjekt ${change.rentalObjectCode} har nu hyresobjektstyp ${quotedCode(change)} i Tenfast.`,
      `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
    ]
  )
}

const notifyUnknownType = (change: RentalObjectTypeChange) =>
  notify(
    `sync-rental-object-types: okänd hyresobjektstyp ${quotedCode(change)} på hyresobjekt ${change.rentalObjectCode}`,
    [
      `Hyresobjekt ${change.rentalObjectCode} fick hyresobjektstyp ${quotedCode(change)} i Xpand (${change.timestamp.toISOString()}), men Tenfast har ingen sådan typ.`,
      `Ingenting har ändrats i Tenfast.`,
      ``,
      `Om Tenfast ska få typen behöver den läggas till i TENFAST_RENTAL_OBJECT_CATEGORIES i leasing-tjänsten.`,
    ]
  )

export const syncRentalObjectTypes = async (
  opts: { stateFile?: string; queueFile?: string } = {}
) => {
  const stateFile = opts.stateFile ?? DEFAULT_STATE_FILE
  const queueFile = opts.queueFile ?? DEFAULT_QUEUE_FILE

  const lastTimestamp = await getLastTimestamp(stateFile)
  if (!lastTimestamp) {
    const now = new Date()
    await saveLastTimestamp(stateFile, now)
    logger.info(
      { startFrom: now },
      'sync-rental-object-types: no saved timestamp, starting from now'
    )
    return
  }

  // 1) Drain queue first
  const queue = await readQueue(queueFile)
  logger.info({ queueDepth: queue.length }, 'draining failure queue')
  for (const entry of queue) {
    if (entry.type !== 'rental-object-type') continue
    const change = reviveChange(entry.payload)
    const result = await syncRentalObjectType(
      change.rentalObjectCode,
      change.code
    )
    if (result.ok) {
      await removeEntry(queueFile, entry.key)
      await notifyRecovery(entry)
    } else if (result.err === 'unknown-type') {
      await removeEntry(queueFile, entry.key)
      await notifyUnknownType(change)
    } else {
      logger.warn(
        { key: entry.key, err: result.err },
        'sync-rental-object-types: queued entry still failing, keeping in queue'
      )
    }
  }

  // 2) Process new cmlog rows
  logger.info(
    { lastTimestamp },
    'syncing rental object types since last timestamp'
  )
  const changesResult = await getRentalObjectTypeChanges(lastTimestamp)
  if (!changesResult.ok) {
    logger.error(
      { err: changesResult.err },
      'Failed to fetch rental object type changes'
    )
    throw new Error(changesResult.err)
  }
  let checkpoint = lastTimestamp
  let handledAtCheckpoint = await getHandledAtCheckpoint(
    stateFile,
    lastTimestamp
  )
  const changes = changesResult.data.filter(
    (change) =>
      change.timestamp.getTime() !== lastTimestamp.getTime() ||
      !handledAtCheckpoint.has(change.rentalObjectCode)
  )
  logger.info({ count: changes.length }, 'rental object type changes to sync')

  let synced = 0
  let unknownType = 0
  let failed = 0
  for (const change of changes) {
    const key = keyFor(change.rentalObjectCode)
    const result = await syncRentalObjectType(
      change.rentalObjectCode,
      change.code
    )

    if (result.ok) {
      synced++
      await removeEntry(queueFile, key)
      logger.info(
        {
          rentalObjectCode: change.rentalObjectCode,
          code: change.code,
          action: result.data.action,
        },
        'rental object type synced'
      )
    } else if (result.err === 'unknown-type') {
      unknownType++
      await removeEntry(queueFile, key)
      await notifyUnknownType(change)
    } else {
      failed++
      const existing = (await readQueue(queueFile)).find((e) => e.key === key)
      const entry: FailedRowEntry = {
        key,
        type: 'rental-object-type',
        payload: { ...change, timestamp: change.timestamp.toISOString() },
        addedAt: new Date().toISOString(),
        lastError: `${result.err} (status ${result.statusCode ?? 'none'})`,
      }
      await upsertEntry(queueFile, entry)
      const isCrashRetry =
        existing !== undefined &&
        reviveChange(existing.payload).timestamp.getTime() ===
          change.timestamp.getTime()
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
    if (change.timestamp.getTime() !== checkpoint.getTime()) {
      checkpoint = change.timestamp
      handledAtCheckpoint = new Set()
    }
    handledAtCheckpoint.add(change.rentalObjectCode)
    await saveHandledAtCheckpoint(stateFile, checkpoint, handledAtCheckpoint)
    await saveLastTimestamp(stateFile, change.timestamp)
  }

  logger.info(
    { total: changes.length, synced, unknownType, failed },
    'sync-rental-object-types run complete'
  )
}

if (require.main === module) {
  syncRentalObjectTypes().catch((err) => {
    logger.error({ err }, 'sync-rental-object-types script failed')
    process.exitCode = 1
  })
}
