import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { sendEmail } from '../../adapters/communication-adapter'
import { syncContactToLeasing } from '../../adapters/leasing-adapter'
import { syncContactToEconomy } from '../../adapters/economy-adapter'
import { syncContactToWorkOrder } from '../../adapters/work-order-adapter'
import type { Contact } from '@onecore/contacts/schema'
import { toSyncPayload } from './payload'
import {
  addEntry,
  hasKey,
  readQueue,
  removeEntry,
  FailedRowEntry,
} from '../shared/failed-sync-queue'

const DEFAULT_STATE_FILE = '/data/last-timestamp.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

type ContactUpdate = { contact: Contact; timestamp: Date }

const getLastTimestamp = async (stateFile: string): Promise<Date | null> => {
  try {
    const content = await fs.readFile(stateFile, 'utf-8')
    const trimmed = content.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const saveLastTimestamp = async (stateFile: string, ts: Date) => {
  const tmp = `${stateFile}.tmp`
  await fs.writeFile(tmp, ts.toISOString(), 'utf-8')
  await fs.rename(tmp, stateFile)
}

const keyFor = (update: ContactUpdate): string =>
  `${update.contact.contactCode}:${update.timestamp.toISOString()}`

const reviveContactFromPayload = (payload: unknown): ContactUpdate => {
  const p = payload as { contact: Contact; timestamp: string | Date }
  return { contact: p.contact, timestamp: new Date(p.timestamp) }
}

const notifyFailure = async (entry: FailedRowEntry) => {
  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      'config.emailAddresses.xpandSync is not set — skipping failure notification'
    )
    return
  }
  const update = reviveContactFromPayload(entry.payload)
  try {
    await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject: `sync-contacts: nytt fel på kontakt ${update.contact.contactCode}`,
      body: [
        `Misslyckades på kontakt ${update.contact.contactCode} vid ${update.timestamp.toISOString()}.`,
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
  const update = reviveContactFromPayload(entry.payload)
  try {
    await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject: `sync-contacts: tidigare felande kontakt ${update.contact.contactCode} är nu synkat`,
      body: [
        `Kontakt ${update.contact.contactCode} är nu synkad.`,
        `Ursprungligt fel (loggat ${entry.addedAt}): ${entry.lastError}`,
      ].join('\n'),
    })
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send recovery notification')
  }
}

const syncContact = async (update: ContactUpdate): Promise<void> => {
  const payload = toSyncPayload(update.contact)
  const [tenfastResult, xledgerResult, odooResult] = await Promise.all([
    syncContactToLeasing(payload.contactCode),
    syncContactToEconomy(payload.contactCode, {
      fullName: payload.fullName,
      street: payload.street,
      zipCode: payload.zipCode,
      city: payload.city,
      emailAddress: payload.emailAddress,
    }),
    syncContactToWorkOrder(payload.contactCode, {
      fullName: payload.fullName,
      emailAddress: payload.emailAddress,
      phoneNumber: payload.phoneNumber,
    }),
  ])
  if (!tenfastResult.ok || !xledgerResult.ok || !odooResult.ok) {
    throw new Error(
      `contact ${payload.contactCode} failed to sync: tenfast=${
        tenfastResult.ok ? 'ok' : tenfastResult.err
      }, xledger=${
        xledgerResult.ok ? 'ok' : xledgerResult.err
      }, odoo=${odooResult.ok ? 'ok' : odooResult.err}`
    )
  }
  logger.info({ contactCode: payload.contactCode }, 'contact synced')
}

export const syncContacts = async (
  opts: { stateFile?: string; queueFile?: string } = {}
) => {
  const stateFile = opts.stateFile ?? DEFAULT_STATE_FILE
  const queueFile = opts.queueFile ?? DEFAULT_QUEUE_FILE

  // 1) Drain queue first
  const queue = await readQueue(queueFile)
  logger.info({ queueDepth: queue.length }, 'draining failure queue')
  for (const entry of queue) {
    if (entry.type !== 'contact') continue
    const update = reviveContactFromPayload(entry.payload)
    try {
      await syncContact(update)
      await removeEntry(queueFile, entry.key)
      await notifyRecovery(entry)
    } catch (err) {
      logger.warn(
        { err, key: entry.key },
        'sync-contacts: queued entry still failing, keeping in queue'
      )
    }
  }

  // 2) Process new cmlog rows
  const lastTimestamp = await getLastTimestamp(stateFile)
  if (lastTimestamp) {
    logger.info({ lastTimestamp }, 'syncing contacts since last timestamp')
  } else {
    logger.info('no saved timestamp, syncing all')
  }
  const contactsAdapter = makeContactsAdapter(config.contactsService.url)
  const result = await contactsAdapter.getUpdatedContacts(lastTimestamp)
  if (!result.ok) {
    logger.error({ err: result.err }, 'Failed to fetch updated contacts')
    throw new Error(result.err)
  }
  const updates = result.data
  logger.info({ count: updates.length }, 'contacts to sync')

  const queueForRun = await readQueue(queueFile)

  let succeeded = 0
  let failed = 0
  for (const update of updates) {
    try {
      await syncContact(update)
      succeeded++
    } catch (err) {
      failed++
      const entry: FailedRowEntry = {
        key: keyFor(update),
        type: 'contact',
        payload: {
          contact: update.contact,
          timestamp: update.timestamp.toISOString(),
        },
        addedAt: new Date().toISOString(),
        lastError: err instanceof Error ? err.message : String(err),
      }
      if (!hasKey(queueForRun, entry.key)) {
        await addEntry(queueFile, entry)
        queueForRun.push(entry)
        await notifyFailure(entry)
        logger.error(
          { err, contactCode: update.contact.contactCode },
          'sync-contacts: queued for retry, mail sent'
        )
      } else {
        logger.warn(
          { key: entry.key },
          'sync-contacts: row failed but already in queue (crash-retry), skipping mail'
        )
      }
    }
    await saveLastTimestamp(stateFile, update.timestamp)
  }

  logger.info(
    { total: updates.length, succeeded, failed },
    'sync-contacts run complete'
  )
}

if (require.main === module) {
  syncContacts().catch((err) => {
    logger.error({ err }, 'sync-contacts script failed')
    process.exitCode = 1
  })
}
