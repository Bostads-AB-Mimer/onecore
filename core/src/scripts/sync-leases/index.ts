import { logger } from '@onecore/utilities'
import { LeaseChange, RentalPropertyInfo } from '@onecore/types'
import config from '../../common/config'
import {
  getUpdatedLeases,
  syncLease as syncLeaseToTenfast,
} from '../../adapters/leasing-adapter'
import { getRentalPropertyInfoFromXpand } from '../../adapters/property-management-adapter'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { syncInvoiceRecipientToEconomy } from '../../processes/contacts'
import { runCmlogSync } from '../shared/run-cmlog-sync'

const DEFAULT_STATE_FILE = '/data/last-timestamp-leases.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

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

const syncLease = async (lease: LeaseChange): Promise<void> => {
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
      { rentalObjectId: lease.rentalObjectId, type: propertyInfo.data.type },
      'rental object type not in scope, skipping'
    )
    return
  }

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

    const otherInvoiceRecipient = contactResult.data.relatedContacts?.find(
      (r) => r.role === 'otherInvoiceRecipient'
    )
    if (otherInvoiceRecipient) {
      logger.info(
        { leaseId: lease.leaseId, action: lease.action },
        'syncing other invoice recipient'
      )

      const synced = await syncInvoiceRecipientToEconomy(
        contactsAdapter,
        otherInvoiceRecipient.contactCode
      )
      if (!synced.ok) {
        throw new Error(
          `Failed to sync other invoice recipient ${otherInvoiceRecipient.contactCode} for lease ${lease.leaseId}: ${synced.err}${synced.detail ? ` (${synced.detail})` : ''}`
        )
      }
    }
  }

  const contactCode = lease.action === 'create' ? lease.contactCode : undefined

  logger.info({ leaseId: lease.leaseId, action: lease.action }, 'syncing lease')
  const syncResult = await syncLeaseToTenfast(
    lease.leaseId,
    contactCode,
    lease.action
  )
  if (!syncResult.ok) {
    throw new Error(`Failed to sync lease ${lease.leaseId}: ${syncResult.err}`)
  }
  logger.info(
    { leaseId: lease.leaseId, action: syncResult.data.action },
    'lease synced'
  )
}

export const syncLeases = (
  opts: { stateFile?: string; queueFile?: string } = {}
) =>
  runCmlogSync<LeaseChange>(
    {
      name: 'sync-leases',
      entryType: 'lease',
      firstRun: 'sync-all',
      fetchChanges: getUpdatedLeases,
      sync: syncLease,
      keyFor: (lease) =>
        `${lease.leaseId}:${lease.action}:${lease.timestamp.toISOString()}`,
      timestampOf: (lease) => lease.timestamp,
      toPayload: (lease) => ({
        ...lease,
        timestamp: lease.timestamp.toISOString(),
      }),
      fromPayload: (payload) => {
        const p = payload as Omit<LeaseChange, 'timestamp'> & {
          timestamp: string
        }
        return { ...p, timestamp: new Date(p.timestamp) }
      },
      describe: (lease) => ({
        subject: `avtal ${lease.leaseId}`,
        detail: `avtal ${lease.leaseId} (action ${lease.action})`,
      }),
      giveUpAdvice:
        'Ändringen har inte nått Tenfast. Gör den i Tenfast för hand.',
    },
    {
      stateFile: opts.stateFile ?? DEFAULT_STATE_FILE,
      queueFile: opts.queueFile ?? DEFAULT_QUEUE_FILE,
    }
  )

if (require.main === module) {
  syncLeases().catch((err) => {
    logger.error({ err }, 'sync-leases script failed')
    process.exitCode = 1
  })
}
