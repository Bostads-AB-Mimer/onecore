import fs from 'fs/promises'
import path from 'path'
import { InvoicePaymentEvent } from '@onecore/types'
import { logger } from '@onecore/utilities'
import {
  getLatestPaymentCursor,
  getPaymentsSince,
  recordInvoicePayment,
} from '../../adapters/economy-adapter'
import { sendEmail } from '../../adapters/communication-adapter'
import config from '../../common/config'

type CursorStore = {
  read: () => Promise<string | null>
  save: (cursor: string) => Promise<void>
}

const getStateFile = () =>
  path.join(process.env.DATA_DIR ?? '/data', 'last-xledger-payment-sync.txt')

export const fileCursorStore: CursorStore = {
  async read() {
    try {
      const content = await fs.readFile(getStateFile(), 'utf-8')
      const cursor = content.trim()
      return cursor.length > 0 ? cursor : null
    } catch {
      return null
    }
  },
  async save(cursor) {
    const stateFile = getStateFile()
    await fs.mkdir(path.dirname(stateFile), { recursive: true })
    await fs.writeFile(stateFile, cursor, 'utf-8')
  },
}

// Groups payment events by invoice ID so that when an invoice is not found in
// Tenfast all of its events can be skipped together without triggering a
// separate lookup for each one. Invoices that are found still result in one
// Tenfast call per payment event.
function groupByInvoiceId(
  events: InvoicePaymentEvent[]
): Map<string, InvoicePaymentEvent[]> {
  const map = new Map<string, InvoicePaymentEvent[]>()
  for (const event of events) {
    const existing = map.get(event.invoiceId) ?? []
    existing.push(event)
    map.set(event.invoiceId, existing)
  }
  return map
}

async function notifySyncFailure(err: unknown) {
  if (!config.emailAddresses.economy) {
    logger.warn(
      'config.emailAddresses.economy is not set — skipping sync failure notification'
    )
    return
  }

  try {
    await sendEmail({
      to: config.emailAddresses.economy,
      subject: 'Fel i körning: sync-xledger-payments-to-tenfast',
      body: [
        'Synkronisering av betalningar från Xledger till Tenfast misslyckades.',
        '',
        `Fel: ${err instanceof Error ? err.message : String(err)}`,
        '',
        'Markören har inte förflyttats. Nästa körning kommer att försöka igen från samma position.',
      ].join('\n'),
    })
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send sync failure notification')
  }
}

async function syncPayments(store: CursorStore = fileCursorStore) {
  let lastCursor = await store.read()

  if (!lastCursor) {
    logger.info('no saved cursor, fetching latest cursor from Xledger')
    const latestResult = await getLatestPaymentCursor()
    if (!latestResult.ok) {
      throw new Error('Failed to fetch latest cursor from Xledger')
    }
    if (!latestResult.data) {
      throw new Error('No cursor found in Xledger — ledger may be empty')
    }
    lastCursor = latestResult.data
    await store.save(lastCursor)
    logger.info(
      { lastCursor },
      'latest cursor saved, starting from here on next run'
    )
    return
  }

  logger.info({ lastCursor }, 'syncing Xledger payments after cursor')

  const paymentsResult = await getPaymentsSince(lastCursor)
  if (!paymentsResult.ok) {
    throw new Error(
      `Failed to fetch payments from Xledger: ${paymentsResult.err}`
    )
  }

  const { events: payments, lastCursor: newCursor } = paymentsResult.data
  logger.info({ count: payments.length }, 'payments fetched from Xledger')

  if (payments.length === 0) {
    logger.info('no new payments')
    return
  }

  const byInvoice = groupByInvoiceId(payments)
  logger.info({ uniqueInvoices: byInvoice.size }, 'unique invoices to process')

  for (const [invoiceId, events] of byInvoice) {
    let invoiceNotFound = false

    for (const event of events) {
      const result = await recordInvoicePayment(invoiceId, {
        amount: event.amount,
        dateTime: event.paymentDate,
        method: event.transactionSourceCode,
      })

      if (!result.ok) {
        if (result.err === 'not-found') {
          // Expected — ströfakturor and procurement invoices won't exist in Tenfast
          logger.info({ invoiceId }, 'invoice not found in Tenfast, skipping')
          invoiceNotFound = true
          break
        }
        throw new Error(
          `Failed to record payment for invoice ${invoiceId} in Tenfast: ${result.err}`
        )
      }

      logger.info(
        { invoiceId, amount: event.amount },
        'payment recorded in Tenfast'
      )
    }

    if (!invoiceNotFound) {
      logger.info(
        { invoiceId, count: events.length },
        'all payments recorded for invoice'
      )
    }
  }

  if (newCursor) {
    await store.save(newCursor)
    logger.info({ newCursor }, 'cursor advanced')
  }

  logger.info({ uniqueInvoices: byInvoice.size }, 'all invoices processed')
}

export { syncPayments, notifySyncFailure }
