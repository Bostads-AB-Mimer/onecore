import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { syncContactToLeasing } from '../../adapters/leasing-adapter'
import { syncContactToEconomy } from '../../adapters/economy-adapter'
import { syncContactToWorkOrder } from '../../adapters/work-order-adapter'
import type { Contact } from '@onecore/contacts/schema'
import { toSyncPayload } from './payload'
import { runCmlogSync } from '../shared/run-cmlog-sync'

const DEFAULT_STATE_FILE = '/data/last-timestamp.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

type ContactUpdate = { contact: Contact; timestamp: Date }

// Written in order, stopping at the first failure. Xledger goes first because
// it is the target that rejects payloads.
const syncContact = async (update: ContactUpdate): Promise<void> => {
  const payload = toSyncPayload(update.contact)
  const steps: [string, () => Promise<{ ok: boolean; err?: string }>][] = [
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

  const done: string[] = []
  for (const [target, run] of steps) {
    const result = await run()
    if (!result.ok) {
      const rest = steps
        .map(([name]) => name)
        .filter((name) => name !== target && !done.includes(name))
      throw new Error(
        `contact ${payload.contactCode} failed to sync: ${target}=${result.err}` +
          (done.length ? `, already written: ${done.join(', ')}` : '') +
          (rest.length ? `, not attempted: ${rest.join(', ')}` : '')
      )
    }
    done.push(target)
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
