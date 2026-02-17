import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type Receipt = keys.Receipt
type CreateReceiptRequest = keys.CreateReceiptRequest
type UpdateReceiptRequest = keys.UpdateReceiptRequest

const TABLE = 'receipts'

/**
 * Database adapter functions for receipts.
 * These functions wrap database calls to make them easier to test.
 */

export async function getReceiptById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Receipt | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getReceiptsByKeyLoanId(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Receipt[]> {
  return await dbConnection(TABLE)
    .where({ keyLoanId })
    .orderBy('createdAt', 'desc')
}

export async function createReceipt(
  receiptData: CreateReceiptRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Receipt> {
  const [row] = await dbConnection(TABLE)
    .insert({
      keyLoanId: receiptData.keyLoanId,
      receiptType: receiptData.receiptType,
      type: receiptData.type,
      fileId: receiptData.fileId ?? null,
    })
    .returning('*')
  return row
}

export async function updateReceipt(
  id: string,
  receiptData: UpdateReceiptRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Receipt | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...receiptData, updatedAt: dbConnection.fn.now() })
    .returning('*')

  return row
}

export async function deleteReceipt(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

/**
 * Check if a key loan exists (for validating receipt creation)
 */
export async function keyLoanExists(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<boolean> {
  const loan = await dbConnection('key_loans').where({ id: keyLoanId }).first()
  return !!loan
}

/**
 * Update receipt with fileId after upload
 */
export async function updateReceiptFileId(
  id: string,
  fileId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  await dbConnection(TABLE).where({ id }).update({
    fileId,
    updatedAt: dbConnection.fn.now(),
  })
}

/**
 * Get key loan by ID with loanType and pickedUpAt fields
 */
export async function getKeyLoanById(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<
  | {
      id: string
      pickedUpAt: string | null
      loanType: 'TENANT' | 'MAINTENANCE'
    }
  | undefined
> {
  return await dbConnection('key_loans').where({ id: keyLoanId }).first()
}

/**
 * Check if a key loan has already been activated (has pickedUpAt set)
 */
export async function isKeyLoanActivated(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<boolean> {
  const loan = await dbConnection('key_loans')
    .where({ id: keyLoanId })
    .whereNotNull('pickedUpAt')
    .first()
  return !!loan
}

/**
 * Activate a key loan by setting pickedUpAt timestamp
 */
export async function activateKeyLoan(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  await dbConnection('key_loans')
    .where({ id: keyLoanId })
    .update({ pickedUpAt: dbConnection.fn.now() })
}

/**
 * Complete key events for the given key IDs
 * Changes status from ORDERED or RECEIVED to COMPLETED
 */
export async function completeKeyEventsForKeys(
  keyIds: string[],
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  if (keyIds.length === 0) return

  await dbConnection('key_events')
    .whereExists(function () {
      this.select(dbConnection.raw(1))
        .from('key_event_keys')
        .whereRaw('key_event_keys.keyEventId = key_events.id')
        .whereIn('key_event_keys.keyId', keyIds)
    })
    .whereIn('status', ['ORDERED', 'RECEIVED'])
    .update({ status: 'COMPLETED', updatedAt: dbConnection.fn.now() })
}
