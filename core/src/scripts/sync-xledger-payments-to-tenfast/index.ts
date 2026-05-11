import fs from 'fs/promises'
import { z } from 'zod'
import { InvoicePaymentEvent } from '@onecore/types'
import { logger } from '@onecore/utilities'
import {
  getPaymentsSince,
  recordInvoicePayment,
} from '../../adapters/economy-adapter'

const STATE_FILE = '/data/last-xledger-payment-sync.txt'

// Fallback window used on the very first run when no state file exists
const FALLBACK_DAYS = 90

// TODO: confirm valid method value with Tenfast (e.g. 'bank', 'bankgiro', 'autogiro')
const DEFAULT_PAYMENT_METHOD = 'bank'

async function getLastTimestamp(): Promise<Date | null> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const result = z.coerce.date().safeParse(content.trim())
    return result.success ? result.data : null
  } catch {
    return null
  }
}

async function saveLastTimestamp(ts: Date) {
  await fs.writeFile(STATE_FILE, ts.toISOString(), 'utf-8')
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
  const syncStart = new Date()
  const lastTimestamp = await getLastTimestamp()

  const fallbackSince = new Date(syncStart)
  fallbackSince.setDate(fallbackSince.getDate() - FALLBACK_DAYS)

  const since = lastTimestamp ?? fallbackSince

  if (lastTimestamp) {
    logger.info({ since }, 'syncing Xledger payments since last timestamp')
  } else {
    logger.info(
      { since },
      `no saved timestamp, using ${FALLBACK_DAYS}-day fallback window`
    )
  }

  const paymentsResult = await getPaymentsSince(since)
  if (!paymentsResult.ok) {
    throw new Error(
      `Failed to fetch payments from Xledger: ${paymentsResult.err}`
    )
  }

  const payments = paymentsResult.data
  logger.info({ count: payments.length }, 'payments fetched from Xledger')

  if (payments.length === 0) {
    await saveLastTimestamp(syncStart)
    logger.info('no new payments, timestamp advanced')
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
        method: DEFAULT_PAYMENT_METHOD,
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

  await saveLastTimestamp(syncStart)
  logger.info(
    { uniqueInvoices: byInvoice.size },
    'all invoices processed, timestamp advanced'
  )
}

syncPayments().catch((err) => {
  logger.error({ err }, 'sync-xledger-payments-to-tenfast script failed')
  process.exitCode = 1
})
