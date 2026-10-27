import fs from 'fs/promises'
import path from 'path'
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

  if (payments.length > 0 && !newCursor) {
    throw new Error(
      'Xledger returned payments but no cursor — cannot advance state safely'
    )
  }

  if (payments.length === 0) {
    logger.info('no new payments')
    if (newCursor) {
      await store.save(newCursor)
      logger.info({ newCursor }, 'cursor advanced')
    }
    return
  }

  // Payments are recorded in Xledger order and the cursor is saved after each
  // one, so a run that fails part-way resumes after the last recorded payment
  // instead of posting the earlier ones to Tenfast again.
  const notInTenfast = new Set<string>()
  let recorded = 0
  let skipped = 0

  for (const event of payments) {
    if (notInTenfast.has(event.invoiceId)) {
      skipped++
    } else {
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
        recorded++
      } else if (result.err === 'not-found') {
        // Expected — ströfakturor and procurement invoices won't exist in Tenfast
        logger.info(
          { invoiceId: event.invoiceId },
          'invoice not found in Tenfast, skipping'
        )
        notInTenfast.add(event.invoiceId)
        skipped++
      } else {
        throw new Error(
          `Failed to record payment for invoice ${event.invoiceId} in Tenfast: ${result.err}`
        )
      }
    }

    await store.save(event.cursor)
  }

  // Covers rows after the last payment that Xledger returned but that had no
  // invoice reference to sync.
  if (newCursor) {
    await store.save(newCursor)
  }

  logger.info(
    { recorded, skipped, cursor: newCursor },
    'all payments processed'
  )
}

export { syncPayments, notifySyncFailure }
