import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import { Contact, RentalPropertyInfo } from '@onecore/types'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { getUpdatedLeases, syncLease } from '../../adapters/leasing-adapter'
import { getRentalPropertyInfoFromXpand } from '../../adapters/property-management-adapter'

// Shape returned by the contacts service — xpand's nested layout.
type XpandContact = {
  contactCode: string
  contactKey: string
  personal?: {
    firstName?: string
    lastName?: string
    fullName?: string
    nationalId?: string
    birthDate?: string | Date
  }
  communication?: {
    phoneNumbers?: { phoneNumber: string; type: string; isPrimary: boolean }[]
    emailAddresses?: {
      emailAddress: string
      type: string
      isPrimary: boolean
    }[]
    specialAttention?: boolean
  }
  addresses?: {
    street?: string
    zipCode?: string
    city?: string
    country?: string
    region?: string
    full?: string
  }[]
}

// Flattens the contacts-service shape into the `@onecore/types` Contact that
// downstream code (including tenfast-adapter.buildTenantRequestData) expects.
const xpandContactToContact = (x: XpandContact): Contact => {
  const primaryEmail =
    x.communication?.emailAddresses?.find((e) => e.isPrimary) ??
    x.communication?.emailAddresses?.[0]
  const primaryAddress = x.addresses?.[0]
  return {
    contactCode: x.contactCode,
    contactKey: x.contactKey,
    firstName: x.personal?.firstName ?? '',
    lastName: x.personal?.lastName ?? '',
    fullName:
      x.personal?.fullName ??
      `${x.personal?.firstName ?? ''} ${x.personal?.lastName ?? ''}`.trim(),
    nationalRegistrationNumber: x.personal?.nationalId ?? '',
    birthDate: x.personal?.birthDate
      ? new Date(x.personal.birthDate)
      : new Date(0),
    address: primaryAddress
      ? {
          street: primaryAddress.street,
          number: '',
          postalCode: primaryAddress.zipCode ?? '',
          city: primaryAddress.city ?? '',
        }
      : undefined,
    phoneNumbers: x.communication?.phoneNumbers?.map((p) => ({
      phoneNumber: p.phoneNumber,
      type: p.type,
      isMainNumber: p.isPrimary,
    })),
    emailAddress: primaryEmail?.emailAddress,
    isTenant: true,
    specialAttention: x.communication?.specialAttention,
    protectedIdentity: false,
    deceased: false,
    emigrated: false,
    noAdvertising: false,
  }
}

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

// Formats a Date as `YYYY-MM-DDTHH:mm:ss±HH:mm` in Europe/Stockholm so the
// stored timestamp matches the wall-clock values in cmlog.logtime (which
// xpand populates as Swedish local time). `new Date()` still parses it back
// to the correct UTC instant on read.
const formatStockholmIso = (ts: Date): string => {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(ts)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  const local = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  const offsetMs = new Date(local + 'Z').getTime() - ts.getTime()
  const offsetMin = Math.round(offsetMs / 60000)
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${local}${sign}${hh}:${mm}`
}

const saveLastTimestamp = async (ts: Date) => {
  await fs.writeFile(STATE_FILE, formatStockholmIso(ts), 'utf-8')
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

      contact = xpandContactToContact(
        contactResult.data as unknown as XpandContact
      )
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
