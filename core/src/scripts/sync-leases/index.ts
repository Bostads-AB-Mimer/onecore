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
import { undoContactSyncInEconomy } from '../../adapters/economy-adapter'
import { runSyncSteps, syncStep, SyncStep } from '../../processes/sync-steps'
import { ProcessStatus } from '../../common/types'
import { runCmlogSync, SyncFailedError } from '../shared/run-cmlog-sync'
import { notifyXpandSync } from '../shared/notify'

const DEFAULT_STATE_FILE = '/data/last-timestamp-leases.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'
const PROPERTY_INFO_TIMEOUT_MS = 30_000

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
    lease.rentalObjectId,
    { timeoutMs: PROPERTY_INFO_TIMEOUT_MS }
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

  const steps: SyncStep[] = []

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
      steps.push(
        syncStep({
          name: 'xledger',
          run: async () => {
            logger.info(
              { leaseId: lease.leaseId, action: lease.action },
              'syncing other invoice recipient'
            )
            const synced = await syncInvoiceRecipientToEconomy(
              contactsAdapter,
              otherInvoiceRecipient.contactCode
            )
            if (!synced.ok) {
              return {
                ...synced,
                detail: `recipient ${otherInvoiceRecipient.contactCode}${synced.detail ? `: ${synced.detail}` : ''}`,
              }
            }
            return {
              ok: true,
              data: { skipped: false, undo: synced.data?.undo },
            }
          },
          undo: (undo) =>
            undoContactSyncInEconomy(otherInvoiceRecipient.contactCode, undo),
        })
      )
    }
  }

  const contactCode = lease.action === 'create' ? lease.contactCode : undefined

  let synced: Pick<
    Extract<
      Awaited<ReturnType<typeof syncLeaseToTenfast>>,
      { ok: true }
    >['data'],
    'document' | 'documentError'
  > = {}
  steps.push(
    syncStep({
      name: 'tenfast',
      run: async () => {
        logger.info(
          { leaseId: lease.leaseId, action: lease.action },
          'syncing lease'
        )
        const syncResult = await syncLeaseToTenfast(
          lease.leaseId,
          contactCode,
          lease.action
        )
        if (!syncResult.ok) return syncResult
        synced = syncResult.data
        logger.info(
          {
            leaseId: lease.leaseId,
            action: syncResult.data.action,
            document: syncResult.data.document,
          },
          'lease synced'
        )
        return { ok: true, data: { skipped: false } }
      },
    })
  )

  const result = await runSyncSteps({
    subject: `lease ${lease.leaseId}`,
    steps,
  })
  if (result.processStatus === ProcessStatus.failed)
    throw new SyncFailedError(result.error)

  if (synced.document === 'missing') {
    await notifyMissingDocument(lease)
  }
  if (synced.document === 'failed') {
    await notifyFailedContract(lease, synced.documentError)
  }
}

const notifyFailedContract = (lease: LeaseChange, error?: string) =>
  notifyXpandSync(
    `sync-leases: signerat kontrakt kunde inte bifogas till avtal ${lease.leaseId}`,
    [
      `Avtal ${lease.leaseId} är skapat i Tenfast, men det signerade kontraktet från Xpand kunde inte bifogas (${error ?? 'okänt fel'}). Det försöks inte igen.`,
      `Bifoga kontraktet i Tenfast för hand.`,
    ]
  )

const notifyMissingDocument = (lease: LeaseChange) => {
  const document =
    lease.action === 'create' ? 'signerat kontrakt' : 'uppsägningsdokument'
  const done = lease.action === 'create' ? 'skapat' : 'uppsagt'
  return notifyXpandSync(
    `sync-leases: avtal ${lease.leaseId} saknar ${document} i Xpand`,
    [
      `Avtal ${lease.leaseId} är ${done} i Tenfast, men inget ${document} hittades i Xpand, så ingen PDF har bifogats.`,
      `Lägg till dokumentet i Tenfast för hand.`,
    ]
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
      // Only terminate and void share a key, so a queued create is never dropped.
      supersedeKey: (lease) =>
        lease.action === 'create'
          ? `${lease.leaseId}:create:${lease.timestamp.toISOString()}`
          : `${lease.leaseId}:end`,
      // Tenfast answers "nothing to do" to a change to a lease it does not
      // hold yet, so a lease's changes must not overtake a queued one.
      orderKey: (lease) => lease.leaseId,
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
      giveUpAdvice: (_lease, entry) =>
        entry.lastError.includes('termination-pdf-')
          ? 'Avtalet är uppsagt i Tenfast, men uppsägningsdokumentet från Xpand kunde inte bifogas. Bifoga det i Tenfast för hand.'
          : 'Ändringen har inte nått Tenfast. Gör den i Tenfast för hand.',
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
