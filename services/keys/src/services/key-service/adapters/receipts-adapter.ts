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
