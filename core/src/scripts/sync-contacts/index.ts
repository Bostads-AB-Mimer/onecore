import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
import { sendEmail } from '../../adapters/communication-adapter'
import { syncContactToLeasing } from '../../adapters/leasing-adapter'
import { syncContactToEconomy } from '../../adapters/economy-adapter'
import { syncContactToWorkOrder } from '../../adapters/work-order-adapter'
import { toSyncPayload } from './payload'

const STATE_FILE = '/data/last-timestamp.txt'

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

const notifySyncFailure = async (p: {
  contactCode: string
  timestamp: Date
  error: unknown
}) => {
  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      'config.emailAddresses.xpandSync is not set — skipping sync failure notification'
    )
    return
  }

  try {
    await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject: 'Fel i körning: sync-contacts',
      body: [
        `Misslyckades på kontakt ${p.contactCode}`,
        `Tidsstämpel: ${p.timestamp.toISOString()}`,
        `Fel: ${p.error instanceof Error ? p.error.message : String(p.error)}`,
        ``,
        `Checkpoint kvar på senaste lyckade kontakten. Nästa körning kommer att misslyckas på samma kontakt tills det åtgärdas.`,
      ].join('\n'),
    })
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send sync failure notification')
  }
}

const syncContacts = async () => {
  const lastTimestamp = await getLastTimestamp()

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

  const contacts = result.data
  logger.info({ count: contacts.length }, 'contacts to sync')

  for (const { contact, timestamp } of contacts) {
    const payload = toSyncPayload(contact)

    try {
      const [tenfastResult, xledgerResult, odooResult] = await Promise.all([
        syncContactToLeasing({
          contactCode: payload.contactCode,
          firstName: payload.firstName,
          lastName: payload.lastName,
          fullName: payload.fullName,
          nationalRegistrationNumber: payload.nationalId,
          emailAddress: payload.emailAddress,
          phoneNumber: payload.phoneNumber,
          street: payload.street,
          zipCode: payload.zipCode,
          city: payload.city,
        }),
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
          `contact ${payload.contactCode} failed to sync: tenfast=${tenfastResult.ok ? 'ok' : tenfastResult.err}, xledger=${xledgerResult.ok ? 'ok' : xledgerResult.err}, odoo=${odooResult.ok ? 'ok' : odooResult.err}`
        )
      }

      logger.info({ contactCode: payload.contactCode }, 'contact synced')

      await saveLastTimestamp(timestamp)
    } catch (err) {
      logger.error(
        { err, contactCode: payload.contactCode },
        'sync-contacts: aborting run on first failure, checkpoint kept at last success'
      )
      await notifySyncFailure({
        contactCode: payload.contactCode,
        timestamp,
        error: err,
      })
      throw err
    }
  }

  logger.info({ count: contacts.length }, 'all contacts processed')
}

syncContacts().catch((err) => {
  logger.error({ err }, 'sync-contacts script failed')
  process.exitCode = 1
})
