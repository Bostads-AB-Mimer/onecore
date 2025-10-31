import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type Receipt = keys.v1.Receipt
type CreateReceiptRequest = keys.v1.CreateReceiptRequest
type UpdateReceiptRequest = keys.v1.UpdateReceiptRequest

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
      loanType: receiptData.loanType,
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
 * Check if a maintenance key loan exists (for validating receipt creation)
 */
export async function maintenanceKeyLoanExists(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<boolean> {
  const loan = await dbConnection('key_loan_maintenance_keys')
    .where({ id: keyLoanId })
    .first()
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
 * Get key loan by ID with keys and loanType fields
 */
export async function getKeyLoanById(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<
  | {
      id: string
      keys: string
      pickedUpAt: string | null
      loanType: 'TENANT' | 'MAINTENANCE'
    }
  | undefined
> {
  return await dbConnection('key_loans').where({ id: keyLoanId }).first()
}

/**
 * Get maintenance key loan by ID with keys field
 */
export async function getMaintenanceKeyLoanById(
  keyLoanId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<
  { id: string; keys: string; pickedUpAt: string | null } | undefined
> {
  return await dbConnection('key_loan_maintenance_keys')
    .where({ id: keyLoanId })
    .first()
}

/**
 * Check if a key loan has already been activated (has pickedUpAt set)
 * Supports both regular and maintenance loans
 */
export async function isKeyLoanActivated(
  keyLoanId: string,
  loanType: 'REGULAR' | 'MAINTENANCE',
  dbConnection: Knex | Knex.Transaction = db
): Promise<boolean> {
  const tableName =
    loanType === 'REGULAR' ? 'key_loans' : 'key_loan_maintenance_keys'
  const loan = await dbConnection(tableName)
    .where({ id: keyLoanId })
    .whereNotNull('pickedUpAt')
    .first()
  return !!loan
}

/**
 * Activate a key loan by setting pickedUpAt timestamp
 * Supports both regular and maintenance loans
 */
export async function activateKeyLoan(
  keyLoanId: string,
  loanType: 'REGULAR' | 'MAINTENANCE',
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  const tableName =
    loanType === 'REGULAR' ? 'key_loans' : 'key_loan_maintenance_keys'
  await dbConnection(tableName)
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
  for (const keyId of keyIds) {
    await dbConnection('key_events')
      .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
      .whereIn('status', ['ORDERED', 'RECEIVED'])
      .update({ status: 'COMPLETED', updatedAt: dbConnection.fn.now() })
  }
}
