import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { syncContactToLeasing } from '../../adapters/leasing-adapter'
import {
  syncContactToEconomy,
  undoContactSyncInEconomy,
} from '../../adapters/economy-adapter'
import {
  syncContactToWorkOrder,
  undoContactSyncInWorkOrder,
} from '../../adapters/work-order-adapter'
import type { Contact } from '@onecore/contacts/schema'
import {
  runSyncSteps,
  syncStep,
  type SyncStep,
} from '../../processes/sync-steps'
import { ProcessStatus } from '../../common/types'
import { ContactSyncPayloadSchema, toSyncPayload } from './payload'
import { runCmlogSync, SyncFailedError } from '../shared/run-cmlog-sync'

const DEFAULT_STATE_FILE = '/data/last-timestamp.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

type ContactUpdate = { contact: Contact; timestamp: Date }

const syncContact = async (update: ContactUpdate): Promise<void> => {
  const payload = toSyncPayload(update.contact)
  const subject = `contact ${payload.contactCode}`

  const steps: SyncStep[] = [
    syncStep({
      name: 'xledger',
      run: () =>
        syncContactToEconomy(
          payload.contactCode,
          {
            fullName: payload.fullName,
            street: payload.street,
            zipCode: payload.zipCode,
            city: payload.city,
            emailAddress: payload.emailAddress,
          },
          { create: false } // Do not create new contact in economy when syncing contacts, only update existing
        ),
      undo: (undo) => undoContactSyncInEconomy(payload.contactCode, undo),
    }),
    syncStep({
      name: 'odoo',
      run: () =>
        syncContactToWorkOrder(payload.contactCode, {
          fullName: payload.fullName,
          emailAddress: payload.emailAddress,
          phoneNumber: payload.phoneNumber,
        }),
      undo: (undo) => undoContactSyncInWorkOrder(payload.contactCode, undo),
    }),
    syncStep({
      name: 'tenfast',
      run: () => syncContactToLeasing(payload.contactCode),
    }),
  ]

  const parsed = ContactSyncPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    const names = steps.map((s) => s.name)
    throw new Error(
      `${subject} failed to sync: invalid payload (${fields}), not attempted: ${names.join(', ')}`
    )
  }

  const result = await runSyncSteps({ subject, steps })
  if (result.processStatus === ProcessStatus.failed)
    throw new SyncFailedError(result.error)
  logger.info({ contactCode: payload.contactCode }, 'contact synced')
}

export const syncContacts = (
  opts: { stateFile?: string; queueFile?: string } = {}
) =>
  runCmlogSync<ContactUpdate>(
    {
      name: 'sync-contacts',
      entryType: 'contact',
      firstRun: 'sync-all',
      fetchChanges: (since) =>
        makeContactsAdapter(config.contactsService.url).getUpdatedContacts(
          since
        ),
      sync: syncContact,
      keyFor: (update) =>
        `${update.contact.contactCode}:${update.timestamp.toISOString()}`,
      supersedeKey: (update) => update.contact.contactCode,
      timestampOf: (update) => update.timestamp,
      toPayload: (update) => ({
        contact: update.contact,
        timestamp: update.timestamp.toISOString(),
      }),
      contentOf: (update) => toSyncPayload(update.contact),
      fromPayload: (payload) => {
        const p = payload as { contact: Contact; timestamp: string }
        return { contact: p.contact, timestamp: new Date(p.timestamp) }
      },
      describe: (update) => ({
        subject: `kontakt ${update.contact.contactCode}`,
        detail: `kontakt ${update.contact.contactCode}`,
      }),
    },
    {
      stateFile: opts.stateFile ?? DEFAULT_STATE_FILE,
      queueFile: opts.queueFile ?? DEFAULT_QUEUE_FILE,
    }
  )

if (require.main === module) {
  syncContacts().catch((err) => {
    logger.error({ err }, 'sync-contacts script failed')
    process.exitCode = 1
  })
}
