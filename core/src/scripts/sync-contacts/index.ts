import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { makeContactsAdapter } from '../../adapters/contacts-adapter'
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
  await fs.writeFile(STATE_FILE, ts.toISOString(), 'utf-8')
}

const syncContacts = async () => {
  const syncStart = new Date()
  const lastTimestamp = await getLastTimestamp()

  if (lastTimestamp) {
    logger.info({ lastTimestamp }, 'syncing contacts since last timestamp')
  } else {
    logger.info('no saved timestamp, syncing all')
  }

  const contactsAdapter = makeContactsAdapter(config.contactsService.url)
  const contactsResult = await contactsAdapter.getUpdatedContacts(lastTimestamp)

  if (!contactsResult.ok) {
    logger.error(
      { err: contactsResult.err },
      'Failed to fetch updated contacts'
    )
    throw new Error(contactsResult.err)
  }

  const contacts = contactsResult.data
  logger.info({ count: contacts.length }, 'contacts to sync')

  let failedCount = 0

  for (const contact of contacts) {
    const payload = toSyncPayload(contact)

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
      failedCount++
      logger.error(
        {
          contactCode: payload.contactCode,
          tenfast: tenfastResult.ok ? 'ok' : tenfastResult.err,
          xledger: xledgerResult.ok ? 'ok' : xledgerResult.err,
          odoo: odooResult.ok ? 'ok' : odooResult.err,
        },
        'contact failed to sync, continuing with remaining contacts'
      )
      continue
    }
    logger.info({ contactCode: payload.contactCode }, 'contact synced')
  }

  await saveLastTimestamp(syncStart)

  if (failedCount > 0) {
    logger.warn(
      { failedCount, totalCount: contacts.length },
      'sync completed with failures, timestamp advanced'
    )
  } else {
    logger.info(
      { count: contacts.length },
      'all contacts synced, timestamp advanced'
    )
  }
}

syncContacts().catch((err) => {
  logger.error({ err }, 'sync-contacts script failed')
  process.exitCode = 1
})
