import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { syncContactToLeasing } from '../../adapters/leasing-adapter'
import { syncContactToEconomy } from '../../adapters/economy-adapter'
import { syncContactToWorkOrder } from '../../adapters/work-order-adapter'
import type { Contact } from '@onecore/contacts/schema'
import type { AdapterResult } from '../../adapters/types'
import { ContactSyncPayloadSchema, toSyncPayload } from './payload'
import { runCmlogSync } from '../shared/run-cmlog-sync'

const DEFAULT_STATE_FILE = '/data/last-timestamp.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

type ContactUpdate = { contact: Contact; timestamp: Date }

type SyncResult = AdapterResult<{ skipped: boolean }, 'sync-failed' | 'unknown'>

const syncError = (
  contactCode: string,
  reason: string,
  written: string[],
  skipped: string[],
  rest: string[]
) =>
  new Error(
    `contact ${contactCode} failed to sync: ${reason}` +
      (written.length ? `, already written: ${written.join(', ')}` : '') +
      (skipped.length ? `, skipped: ${skipped.join(', ')}` : '') +
      (rest.length ? `, not attempted: ${rest.join(', ')}` : '')
  )

// Written in order, stopping at the first failure.
const syncContact = async (update: ContactUpdate): Promise<void> => {
  const payload = toSyncPayload(update.contact)
  const steps: [string, () => Promise<SyncResult>][] = [
    [
      'xledger',
      () =>
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
    ],
    [
      'odoo',
      () =>
        syncContactToWorkOrder(payload.contactCode, {
          fullName: payload.fullName,
          emailAddress: payload.emailAddress,
          phoneNumber: payload.phoneNumber,
        }),
    ],
    ['tenfast', () => syncContactToLeasing(payload.contactCode)],
  ]

  const names = steps.map(([name]) => name)

  const parsed = ContactSyncPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw syncError(
      payload.contactCode,
      `invalid payload (${fields})`,
      [],
      [],
      names
    )
  }

  const written: string[] = []
  const skipped: string[] = []
  for (const [i, [target, run]] of steps.entries()) {
    const result = await run()
    if (!result.ok) {
      const status = result.statusCode ? ` (${result.statusCode})` : ''
      throw syncError(
        payload.contactCode,
        `${target}=${result.err}${status}`,
        written,
        skipped,
        names.slice(i + 1)
      )
    }
    ;(result.data.skipped ? skipped : written).push(target)
  }
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
