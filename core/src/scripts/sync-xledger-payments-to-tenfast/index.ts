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

async function getLastSyncDate(): Promise<Date | null> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const result = z.coerce.date().safeParse(content.trim())
    return result.success ? result.data : null
  } catch {
    return null
  }
}

// Saves the day after syncDate as the next since-boundary (UTC YYYY-MM-DD).
// Advancing by one day means a same-day re-run queries from the next day,
// avoiding re-processing payments already recorded in this run.
async function saveNextSyncDate(syncDate: Date) {
  const next = new Date(syncDate)
  next.setUTCDate(next.getUTCDate() + 1)
  await fs.writeFile(STATE_FILE, next.toISOString().slice(0, 10), 'utf-8')
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
  const lastSyncDate = await getLastSyncDate()

  const fallbackSince = new Date(syncStart)
  fallbackSince.setUTCDate(fallbackSince.getUTCDate() - FALLBACK_DAYS)

  const since = lastSyncDate ?? fallbackSince

  if (lastSyncDate) {
    logger.info({ since }, 'syncing Xledger payments since last sync date')
  } else {
    logger.info(
      { since },
      `no saved sync date, using ${FALLBACK_DAYS}-day fallback window`
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
    await saveNextSyncDate(syncStart)
    logger.info('no new payments, sync date advanced')
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

  await saveNextSyncDate(syncStart)
  logger.info(
    { uniqueInvoices: byInvoice.size },
    'all invoices processed, sync date advanced'
  )
}

syncPayments().catch((err) => {
  logger.error({ err }, 'sync-xledger-payments-to-tenfast script failed')
  process.exitCode = 1
})
