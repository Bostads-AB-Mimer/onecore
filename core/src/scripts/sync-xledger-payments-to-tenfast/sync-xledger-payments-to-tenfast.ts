import fs from 'fs/promises'
import path from 'path'
import { errorMessage, logger } from '@onecore/utilities'
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
  // Only a missing file means no cursor has been saved. Anything else must
  // stop the run: read as "no cursor" it would restart the sync from
  // Xledger's latest payment and silently skip every payment in between.
  async read() {
    const stateFile = getStateFile()
    let content: string
    try {
      content = await fs.readFile(stateFile, 'utf-8')
    } catch (err: unknown) {
      // fs rejects with a NodeJS.ErrnoException; same check as
      // shared/last-timestamp.ts (instanceof Error fails across Jest realms).
      if ((err as { code?: string }).code === 'ENOENT') {
        return null
      }
      throw new Error(
        `Could not read payment sync cursor from ${stateFile}: ${errorMessage(err)}`
      )
    }

    const cursor = content.trim()
    // save() writes atomically, so an empty file is corruption, not a first run.
    if (cursor.length === 0) {
      throw new Error(`Payment sync cursor file ${stateFile} is empty`)
    }
    return cursor
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

type RejectedPayment = { event: PaymentSyncEvent; reason: string }

// A rejected payment is skipped and never tried again, so this message is the
// only way someone learns to book it by hand. Returns whether it was sent.
async function notifyRejectedPayments(
  rejected: readonly RejectedPayment[]
): Promise<boolean> {
  if (!config.emailAddresses.economy) {
    logger.error(
      { invoiceIds: rejected.map(({ event }) => event.invoiceId) },
      'config.emailAddresses.economy is not set — cannot report payments rejected by Tenfast'
    )
    return false
  }

  const result = await sendEmail({
    to: config.emailAddresses.economy,
    subject:
      'Betalningar avvisade av Tenfast: sync-xledger-payments-to-tenfast',
    body: [
      'Tenfast avvisade följande betalningar från Xledger. De är inte registrerade i Tenfast och synken har gått vidare förbi dem, så de behöver hanteras manuellt.',
      '',
      ...rejected.map(
        ({ event, reason }) =>
          // Xledger payments are negative AR credits; show what was paid.
          `- Faktura ${event.invoiceId}: ${Math.abs(event.amount)} kr, betalningsdatum ${event.paymentDate.toISOString().slice(0, 10)}. Orsak: ${reason}`
      ),
    ].join('\n'),
  })

  if (!result.ok) {
    logger.error(
      {
        err: result.err,
        statusCode: result.statusCode,
        invoiceIds: rejected.map(({ event }) => event.invoiceId),
      },
      'failed to send rejected payments notification'
    )
    return false
  }
  return true
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

type RecordOutcome =
  | { status: 'recorded' }
  | { status: 'not-in-tenfast' }
  | { status: 'rejected'; reason: string }

// Records one payment in Tenfast. Throws on errors that may be temporary, so
// the run stops and the payment is tried again next time.
async function recordPayment(event: PaymentSyncEvent): Promise<RecordOutcome> {
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
    return { status: 'recorded' }
  }

  // Expected — ströfakturor and procurement invoices won't exist in Tenfast
  if (result.err === 'not-found') {
    logger.info(
      { invoiceId: event.invoiceId },
      'invoice not found in Tenfast, skipping'
    )
    return { status: 'not-in-tenfast' }
  }

  // Tenfast will refuse this payment on every retry (e.g. a voided invoice),
  // so retrying would block every payment after it. Skip it and report it.
  if (result.err === 'payment-rejected') {
    const reason = result.detail ?? 'no reason given'
    logger.error(
      {
        invoiceId: event.invoiceId,
        amount: event.amount,
        paymentDate: event.paymentDate,
        reason,
      },
      'payment rejected by Tenfast, skipping'
    )
    return { status: 'rejected', reason }
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

  // Invoices known to be missing from Tenfast: later payments to them are
  // skipped without asking again.
  const notInTenfast = new Set<string>()
  const rejected: RejectedPayment[] = []
  let rejectedReported = true

  try {
    // Payments are recorded in Xledger order and the cursor is saved after
    // each one, so a run that fails part-way resumes after the last recorded
    // payment instead of posting the earlier ones to Tenfast again.
    for (const event of events) {
      if (!notInTenfast.has(event.invoiceId)) {
        const outcome = await recordPayment(event)
        if (outcome.status === 'not-in-tenfast') {
          notInTenfast.add(event.invoiceId)
        } else if (outcome.status === 'rejected') {
          rejected.push({ event, reason: outcome.reason })
        }
      }
      await store.save(event.cursor)
    }

    // Also covers rows after the last payment that Xledger returned but that
    // had no invoice reference to sync.
    if (lastCursor) {
      await store.save(lastCursor)
    }
  } finally {
    // Rejected payments are behind the saved cursor and won't be tried again,
    // so report them even when the run fails part-way.
    if (rejected.length > 0) {
      rejectedReported = await notifyRejectedPayments(rejected)
    }
  }

  if (!rejectedReported) {
    throw new Error(
      `${rejected.length} payment(s) rejected by Tenfast could not be reported by email: ${rejected.map(({ event }) => event.invoiceId).join(', ')}`
    )
  }

  logger.info(
    {
      payments: events.length,
      notInTenfast: [...notInTenfast],
      rejected: rejected.map(({ event }) => event.invoiceId),
      cursor: lastCursor ?? cursor,
    },
    'payment sync done'
  )
}

export { syncPayments, notifySyncFailure }
