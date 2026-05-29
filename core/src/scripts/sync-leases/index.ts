import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import { toSyncLeasingPayload } from './to-sync-leasing-payload'
import { RentalPropertyInfo, SyncContactToLeasingPayload } from '@onecore/types'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { getUpdatedLeases, syncLease } from '../../adapters/leasing-adapter'
import { getRentalPropertyInfoFromXpand } from '../../adapters/property-management-adapter'

const STATE_FILE = '/data/last-timestamp-leases.txt'

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

const syncLeases = async () => {
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

  const contactsAdapter = makeContactsAdapter(config.contactsService.url)

  for (const lease of leases) {
    try {
      // Step 1: Check rental object type via property management service
      const propertyInfo = await getRentalPropertyInfoFromXpand(
        lease.rentalObjectId
      )

      if (propertyInfo.status !== 200 || !propertyInfo.data) {
        throw new Error(
          `Failed to fetch rental property info for ${lease.rentalObjectId} (status ${propertyInfo.status})`
        )
      }

      if (!isResidenceOrStorage(propertyInfo.data)) {
        logger.info(
          {
            rentalObjectId: lease.rentalObjectId,
            type: propertyInfo.data.type,
          },
          'rental object type not in scope, skipping'
        )
        await saveLastTimestamp(lease.timestamp)
        continue
      }

      // Step 2: Get full contact from contacts service (only needed for create)
      let contact: SyncContactToLeasingPayload | undefined = undefined
      if (lease.action === 'create') {
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

      // Step 3: Sync lease to Tenfast via leasing service
      logger.info(
        { leaseId: lease.leaseId, action: lease.action },
        'syncing lease'
      )
      const syncResult = await syncLease(lease.leaseId, contact, lease.action)

      if (!syncResult.ok) {
        throw new Error(
          `Failed to sync lease ${lease.leaseId}: ${syncResult.err}`
        )
      }

      logger.info(
        { leaseId: lease.leaseId, action: syncResult.data.action },
        'lease synced'
      )

      await saveLastTimestamp(lease.timestamp)
    } catch (err) {
      logger.error(
        { err, leaseId: lease.leaseId, action: lease.action },
        'sync-leases: aborting run on first failure, checkpoint kept at last success'
      )
      throw err
    }
  }

  logger.info({ count: leases.length }, 'all leases processed')
}

syncLeases().catch((err) => {
  logger.error({ err }, 'sync-leases script failed')
  process.exitCode = 1
})
