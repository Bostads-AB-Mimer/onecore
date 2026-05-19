import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import { Contact, RentalPropertyInfo } from '@onecore/types'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { getUpdatedLeases, syncLease } from '../../adapters/leasing-adapter'
import { getRentalPropertyInfoFromXpand } from '../../adapters/property-management-adapter'

const STATE_FILE = './last-timestamp-leases.txt'
// const STATE_FILE = '/data/last-timestamp-leases.txt'

const isResidenceOrStorage = (info: RentalPropertyInfo): boolean => {
  logger.info(info.type)
  logger.info(info.property)
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
  await fs.writeFile(STATE_FILE, ts.toISOString(), 'utf-8')
}

const syncLeases = async () => {
  const syncStart = new Date()
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
    // Step 1: Check rental object type via property management service
    const propertyInfo = await getRentalPropertyInfoFromXpand(
      lease.rentalObjectId
    )

    if (propertyInfo.status !== 200 || !propertyInfo.data) {
      logger.warn(
        { rentalObjectId: lease.rentalObjectId, status: propertyInfo.status },
        'could not determine rental object type, skipping'
      )
      continue
    }
    // logger.info(propertyInfo.data)

    if (!isResidenceOrStorage(propertyInfo.data)) {
      logger.info(
        {
          rentalObjectId: lease.rentalObjectId,
          type: propertyInfo.data.type,
        },
        'rental object type not in scope, skipping'
      )
      continue
    }

    // Step 2: Get full contact from contacts service (only needed for create)
    let contact: Contact | undefined = undefined
    if (lease.action === 'create') {
      const contactResult = await contactsAdapter.getByContactCode(
        lease.contactCode
      )

      if (!contactResult.ok) {
        throw new Error(
          `Failed to get contact ${lease.contactCode} for lease ${lease.leaseId}: ${contactResult.err}`
        )
      }

      contact = contactResult.data as unknown as Contact
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
  }

  await saveLastTimestamp(syncStart)
  logger.info(
    { count: leases.length },
    'all leases processed, timestamp advanced'
  )
}

syncLeases().catch((err) => {
  logger.error({ err }, 'sync-leases script failed')
  process.exitCode = 1
})
