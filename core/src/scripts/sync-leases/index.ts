import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import { toSyncLeasingPayload } from './to-sync-leasing-payload'
import {
  LeaseChange,
  RentalPropertyInfo,
  SyncContactToLeasingPayload,
} from '@onecore/types'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { sendEmail } from '../../adapters/communication-adapter'
import {
  getUpdatedLeases,
  syncLease as syncLeaseToTenfast,
} from '../../adapters/leasing-adapter'
import { getRentalPropertyInfoFromXpand } from '../../adapters/property-management-adapter'
import {
  addEntry,
  hasKey,
  readQueue,
  removeEntry,
  FailedRowEntry,
} from '../shared/failed-sync-queue'

const STATE_FILE = '/data/last-timestamp-leases.txt'
const QUEUE_FILE = '/data/failed-rows.jsonl'

const isResidenceOrStorage = (info: RentalPropertyInfo): boolean => {
  if (info.type.toLowerCase() === 'lägenhet') return true
  if (
    info.type.toLowerCase() === 'lokal' &&
    'type' in info.property &&
    info.property.type.toLowerCase() === 'förråd'
  )
    return true
  return false
}

const getLastTimestamp = async (): Promise<Date | null> => {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const trimmed = content.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const saveLastTimestamp = async (ts: Date) => {
  const tmp = `${STATE_FILE}.tmp`
  await fs.writeFile(tmp, ts.toISOString(), 'utf-8')
  await fs.rename(tmp, STATE_FILE)
}

const keyFor = (lease: LeaseChange): string =>
  `${lease.leaseId}:${lease.action}:${lease.timestamp.toISOString()}`

const reviveLeaseFromPayload = (payload: unknown): LeaseChange => {
  const p = payload as Omit<LeaseChange, 'timestamp'> & {
    timestamp: string | Date
  }
  return { ...p, timestamp: new Date(p.timestamp) }
}

const notifyFailure = async (entry: FailedRowEntry) => {
  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      'config.emailAddresses.xpandSync is not set — skipping failure notification'
    )
    return
  }
  const lease = reviveLeaseFromPayload(entry.payload)
  try {
    await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject: `sync-leases: nytt fel på avtal ${lease.leaseId}`,
      body: [
        `Misslyckades på avtal ${lease.leaseId} (action ${lease.action}) vid ${lease.timestamp.toISOString()}.`,
        `Fel: ${entry.lastError}`,
        ``,
        `Raden ligger nu i återförsökskön på PVC (/data/failed-rows.jsonl) och kommer att försökas igen vid nästa körning. Du får ett bekräftelsemail när den lyckas synkas.`,
      ].join('\n'),
    })
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send failure notification')
  }
}

const notifyRecovery = async (entry: FailedRowEntry) => {
  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      'config.emailAddresses.xpandSync is not set — skipping recovery notification'
    )
    return
  }
  const lease = reviveLeaseFromPayload(entry.payload)
  try {
    await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject: `sync-leases: tidigare felande avtal ${lease.leaseId} är nu synkat`,
      body: [
        `Avtal ${lease.leaseId} (action ${lease.action}) är nu synkat.`,
        `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
      ].join('\n'),
    })
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send recovery notification')
  }
}

const syncLease = async (lease: LeaseChange): Promise<void> => {
  const propertyInfo = await getRentalPropertyInfoFromXpand(lease.rentalObjectId)
  if (propertyInfo.status !== 200 || !propertyInfo.data) {
    throw new Error(
      `Failed to fetch rental property info for ${lease.rentalObjectId} (status ${propertyInfo.status})`
    )
  }
  if (!isResidenceOrStorage(propertyInfo.data)) {
    logger.info(
      { rentalObjectId: lease.rentalObjectId, type: propertyInfo.data.type },
      'rental object type not in scope, skipping'
    )
    return
  }

  let contact: SyncContactToLeasingPayload | undefined = undefined
  if (lease.action === 'create') {
    const contactsAdapter = makeContactsAdapter(config.contactsService.url)
    const contactResult = await contactsAdapter.getByContactCode(
      lease.contactCode
    )
    if (!contactResult.ok) {
      throw new Error(
        `Failed to get contact ${lease.contactCode} for lease ${lease.leaseId}: ${contactResult.err}`
      )
    }
    contact = toSyncLeasingPayload(contactResult.data)
  }

  logger.info({ leaseId: lease.leaseId, action: lease.action }, 'syncing lease')
  const syncResult = await syncLeaseToTenfast(
    lease.leaseId,
    contact,
    lease.action
  )
  if (!syncResult.ok) {
    throw new Error(
      `Failed to sync lease ${lease.leaseId}: ${syncResult.err}`
    )
  }
  logger.info(
    { leaseId: lease.leaseId, action: syncResult.data.action },
    'lease synced'
  )
}

const syncLeases = async () => {
  // 1) Drain queue first
  const queue = await readQueue(QUEUE_FILE)
  logger.info({ queueDepth: queue.length }, 'draining failure queue')
  for (const entry of queue) {
    if (entry.type !== 'lease') continue
    const lease = reviveLeaseFromPayload(entry.payload)
    try {
      await syncLease(lease)
      await removeEntry(QUEUE_FILE, entry.key)
      await notifyRecovery(entry)
    } catch (err) {
      logger.warn(
        { err, key: entry.key },
        'sync-leases: queued entry still failing, keeping in queue'
      )
    }
  }

  // 2) Process new cmlog rows
  const lastTimestamp = await getLastTimestamp()
  if (lastTimestamp) {
    logger.info({ lastTimestamp }, 'syncing leases since last timestamp')
  } else {
    logger.info('no saved timestamp, syncing all')
  }
  const leasesResult = await getUpdatedLeases(lastTimestamp)
  if (!leasesResult.ok) {
    logger.error({ err: leasesResult.err }, 'Failed to fetch updated leases')
    throw new Error(leasesResult.err)
  }
  const leases = leasesResult.data
  logger.info({ count: leases.length }, 'lease changes to process')

  // Re-read queue for the new-row loop's dedupe check.
  const queueForRun = await readQueue(QUEUE_FILE)

  for (const lease of leases) {
    try {
      await syncLease(lease)
    } catch (err) {
      const entry: FailedRowEntry = {
        key: keyFor(lease),
        type: 'lease',
        payload: { ...lease, timestamp: lease.timestamp.toISOString() },
        addedAt: new Date().toISOString(),
        lastError: err instanceof Error ? err.message : String(err),
      }
      if (!hasKey(queueForRun, entry.key)) {
        await addEntry(QUEUE_FILE, entry)
        queueForRun.push(entry)
        await notifyFailure(entry)
        logger.error(
          { err, leaseId: lease.leaseId },
          'sync-leases: queued for retry, mail sent'
        )
      } else {
        logger.warn(
          { key: entry.key },
          'sync-leases: row failed but already in queue (crash-retry), skipping mail'
        )
      }
    }
    await saveLastTimestamp(lease.timestamp)
  }

  logger.info({ count: leases.length }, 'all leases processed')
}

syncLeases().catch((err) => {
  logger.error({ err }, 'sync-leases script failed')
  process.exitCode = 1
})
