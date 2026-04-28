import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import { Contact } from '@onecore/types'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { getUpdatedLeases, syncLease } from '../../adapters/leasing-adapter'
import { getRentalObjectType } from '../../adapters/property-base-adapter'

const STATE_FILE = '/data/last-timestamp-leases.txt'

const ALLOWED_RENTAL_OBJECT_TYPES = ['Lägenhet', 'Förråd']

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
    logger.info('no saved timestamp, using fallback window')
  }

  const leasesResult = await getUpdatedLeases(lastTimestamp)

  if (!leasesResult.ok) {
    logger.error({ err: leasesResult.err }, 'Failed to fetch updated leases')
    throw new Error(leasesResult.err)
  }

  const leaseChanges = leasesResult.data
  logger.info({ count: leaseChanges.length }, 'lease changes to process')

  const contactsAdapter = makeContactsAdapter(config.contactsService.url)

  for (const change of leaseChanges) {
    // Step 1: Check rental object type via property service
    const typeResult = await getRentalObjectType(change.rentalObjectId)

    if (!typeResult.ok) {
      logger.warn(
        { rentalObjectId: change.rentalObjectId, err: typeResult.err },
        'could not determine rental object type, skipping'
      )
      continue
    }

    if (!ALLOWED_RENTAL_OBJECT_TYPES.includes(typeResult.data.name ?? '')) {
      logger.info(
        {
          rentalObjectId: change.rentalObjectId,
          type: typeResult.data.name,
        },
        'rental object type not in scope, skipping'
      )
      continue
    }

    // Step 2: Get full contact from contacts service
    const contactResult = await contactsAdapter.getByContactCode(
      change.contactCode
    )

    if (!contactResult.ok) {
      throw new Error(
        `Failed to get contact ${change.contactCode} for lease ${change.leaseId}: ${contactResult.err}`
      )
    }

    // Step 3: Sync lease + contact to Tenfast via leasing service
    // Cast contact to @onecore/types Contact — the data is sent as JSON over
    // HTTP so the structural difference between the two Contact types is
    // irrelevant at runtime.
    const syncResult = await syncLease(
      change.leaseId,
      contactResult.data as unknown as Contact
    )

    if (!syncResult.ok) {
      throw new Error(
        `Failed to sync lease ${change.leaseId}: ${syncResult.err}`
      )
    }

    logger.info(
      { leaseId: change.leaseId, action: syncResult.data.action },
      'lease synced'
    )
  }

  await saveLastTimestamp(syncStart)
  logger.info(
    { count: leaseChanges.length },
    'all leases processed, timestamp advanced'
  )
}

syncLeases().catch((err) => {
  logger.error({ err }, 'sync-leases script failed')
  process.exitCode = 1
})
