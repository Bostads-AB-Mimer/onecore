import fs from 'fs/promises'
import path from 'path'
import { InvoicePaymentEvent } from '@onecore/types'
import { logger } from '@onecore/utilities'
import {
  getLatestPaymentCursor,
  getPaymentsSince,
  recordInvoicePayment,
} from '../../adapters/economy-adapter'

const STATE_FILE = path.join(
  process.env.DATA_DIR ?? '/data',
  'last-xledger-payment-sync.txt'
)

async function getLastCursor(): Promise<string | null> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const cursor = content.trim()
    return cursor.length > 0 ? cursor : null
  } catch {
    return null
  }
}

async function saveLastCursor(cursor: string) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true })
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
  let lastCursor = await getLastCursor()

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
    await saveLastCursor(lastCursor)
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
    await saveLastCursor(newCursor)
    logger.info({ newCursor }, 'cursor advanced')
  }

  logger.info({ uniqueInvoices: byInvoice.size }, 'all invoices processed')
}

syncPayments().catch((err) => {
  logger.error({ err }, 'sync-xledger-payments-to-tenfast script failed')
  process.exitCode = 1
})
