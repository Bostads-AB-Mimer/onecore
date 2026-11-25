import fs from 'fs/promises'
import path from 'path'
import { logger } from '@onecore/utilities'
import { PaymentSyncEvent } from '@onecore/types'
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
  // Saved after every payment, so write to a temp file and rename it over the
  // state file: a crash mid-write must never leave an empty cursor, which
  // would read as a first run and skip ahead to Xledger's latest payment.
  async save(cursor) {
    const stateFile = getStateFile()
    const tmpFile = `${stateFile}.tmp`
    await fs.mkdir(path.dirname(stateFile), { recursive: true })
    await fs.writeFile(tmpFile, cursor, 'utf-8')
    await fs.rename(tmpFile, stateFile)
  },
}

async function notifySyncFailure(err: unknown) {
  if (!config.emailAddresses.economy) {
    logger.warn(
      'config.emailAddresses.economy is not set — skipping sync failure notification'
    )
    return
  }

  const result = await sendEmail({
    to: config.emailAddresses.economy,
    subject: 'Fel i körning: sync-xledger-payments-to-tenfast',
    body: [
      'Synkronisering av betalningar från Xledger till Tenfast misslyckades.',
      '',
      `Fel: ${err instanceof Error ? err.message : String(err)}`,
      '',
      'Markören står kvar efter den senast registrerade betalningen. Nästa körning fortsätter därifrån.',
    ].join('\n'),
  })

  if (!result.ok) {
    logger.error(
      { err: result.err, statusCode: result.statusCode },
      'failed to send sync failure notification'
    )
  }
}

// First run: start from Xledger's latest payment. Earlier payments are not
// synced.
async function startFromLatestCursor(store: CursorStore) {
  logger.info('no saved cursor, fetching latest cursor from Xledger')
  const latest = await getLatestPaymentCursor()
  if (!latest.ok) {
    throw new Error('Failed to fetch latest cursor from Xledger')
  }
  if (!latest.data) {
    throw new Error('No cursor found in Xledger — ledger may be empty')
  }
  await store.save(latest.data)
  logger.info(
    { lastCursor: latest.data },
    'latest cursor saved, starting from here on next run'
  )
}

async function fetchPaymentsAfter(cursor: string) {
  logger.info({ lastCursor: cursor }, 'syncing Xledger payments after cursor')
  const result = await getPaymentsSince(cursor)
  if (!result.ok) {
    throw new Error(`Failed to fetch payments from Xledger: ${result.err}`)
  }
  const { events, lastCursor } = result.data
  if (events.length > 0 && !lastCursor) {
    throw new Error(
      'Xledger returned payments but no cursor — cannot advance state safely'
    )
  }
  logger.info({ count: events.length }, 'payments fetched from Xledger')
  return { events, lastCursor }
}

// Records one payment in Tenfast. Takes and returns the invoices known to be
// missing from Tenfast, so later payments to them are skipped without asking
// again.
async function recordPayment(
  notInTenfast: ReadonlySet<string>,
  event: PaymentSyncEvent
): Promise<ReadonlySet<string>> {
  if (notInTenfast.has(event.invoiceId)) {
    return notInTenfast
  }

  const result = await recordInvoicePayment(event.invoiceId, {
    amount: event.amount,
    dateTime: event.paymentDate,
    method: event.transactionSourceCode,
  })

  if (result.ok) {
    logger.info(
      { invoiceId: event.invoiceId, amount: event.amount },
      'payment recorded in Tenfast'
    )
    return notInTenfast
  }

  // Expected — ströfakturor and procurement invoices won't exist in Tenfast
  if (result.err === 'not-found') {
    logger.info(
      { invoiceId: event.invoiceId },
      'invoice not found in Tenfast, skipping'
    )
    return new Set(notInTenfast).add(event.invoiceId)
  }

  throw new Error(
    `Failed to record payment for invoice ${event.invoiceId} in Tenfast: ${result.err}`
  )
}

async function syncPayments(store: CursorStore = fileCursorStore) {
  const cursor = await store.read()
  if (!cursor) {
    return startFromLatestCursor(store)
  }

  const { events, lastCursor } = await fetchPaymentsAfter(cursor)

  // Payments are recorded in Xledger order and the cursor is saved after each
  // one, so a run that fails part-way resumes after the last recorded payment
  // instead of posting the earlier ones to Tenfast again.
  let notInTenfast: ReadonlySet<string> = new Set()
  for (const event of events) {
    notInTenfast = await recordPayment(notInTenfast, event)
    await store.save(event.cursor)
  }

  // Also covers rows after the last payment that Xledger returned but that
  // had no invoice reference to sync.
  if (lastCursor) {
    await store.save(lastCursor)
  }

  logger.info(
    {
      payments: events.length,
      notInTenfast: [...notInTenfast],
      cursor: lastCursor ?? cursor,
    },
    'payment sync done'
  )
}

export { syncPayments, notifySyncFailure }
