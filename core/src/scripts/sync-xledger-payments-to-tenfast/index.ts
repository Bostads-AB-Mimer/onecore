import fs from 'fs/promises'
import { InvoicePaymentEvent } from '@onecore/types'
import { logger } from '@onecore/utilities'
import {
  getPaymentsSince,
  recordInvoicePayment,
} from '../../adapters/economy-adapter'

const STATE_FILE = '/data/last-xledger-payment-sync.txt'

// Cursor of the last Xledger arTransaction record at the time of initial
// deployment. Used on the very first run (no state file) to avoid replaying
// the full ledger history. Obtained from Magnus at View on 2026-05-12.
const BOOTSTRAP_CURSOR = '298329024'

async function getLastCursor(): Promise<string> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const cursor = content.trim()
    return cursor.length > 0 ? cursor : BOOTSTRAP_CURSOR
  } catch {
    return BOOTSTRAP_CURSOR
  }
}

async function saveLastCursor(cursor: string) {
  await fs.writeFile(STATE_FILE, cursor, 'utf-8')
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

async function syncPayments() {
  const lastCursor = await getLastCursor()

  logger.info({ lastCursor }, 'syncing Xledger payments after cursor')

  const paymentsResult = await getPaymentsSince(lastCursor)
  if (!paymentsResult.ok) {
    throw new Error(
      `Failed to fetch payments from Xledger: ${paymentsResult.err}`
    )
  }

  const { events: payments, lastCursor: newCursor } = paymentsResult.data
  logger.info({ count: payments.length }, 'payments fetched from Xledger')

  if (newCursor) {
    await saveLastCursor(newCursor)
    logger.info({ newCursor }, 'cursor advanced')
  }

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

  logger.info({ uniqueInvoices: byInvoice.size }, 'all invoices processed')
}

syncPayments().catch((err) => {
  logger.error({ err }, 'sync-xledger-payments-to-tenfast script failed')
  process.exitCode = 1
})
