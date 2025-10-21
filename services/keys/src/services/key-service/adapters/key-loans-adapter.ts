import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan
type CreateKeyLoanRequest = keys.v1.CreateKeyLoanRequest
type UpdateKeyLoanRequest = keys.v1.UpdateKeyLoanRequest

const TABLE = 'key_loans'

/**
 * Database adapter functions for key loans.
 * These functions wrap database calls to make them easier to test.
 */

export async function getAllKeyLoans(
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  return await dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

export async function getKeyLoanById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getKeyLoansByKeyId(
  keyId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  return await dbConnection(TABLE)
    .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
    .orderBy('createdAt', 'desc')
}

export async function createKeyLoan(
  keyLoanData: CreateKeyLoanRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan> {
  const [row] = await dbConnection(TABLE).insert(keyLoanData).returning('*')
  return row
}

export async function updateKeyLoan(
  id: string,
  keyLoanData: UpdateKeyLoanRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...keyLoanData, updatedAt: dbConnection.fn.now() })
    .returning('*')

  return row
}

export async function deleteKeyLoan(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

/**
 * Check if any of the provided keys have active loans (not returned yet)
 * @param keyIds - Array of key IDs to check
 * @param excludeLoanId - Optional loan ID to exclude from the check (for updates)
 * @param dbConnection - Database connection
 * @returns Object with hasConflict flag and array of conflicting key IDs
 */
export async function checkActiveKeyLoans(
  keyIds: string[],
  excludeLoanId?: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{ hasConflict: boolean; conflictingKeys: string[] }> {
  if (keyIds.length === 0) {
    return { hasConflict: false, conflictingKeys: [] }
  }

  const conflictingKeys: string[] = []

  // Check each key ID for active loans
  for (const keyId of keyIds) {
    let query = dbConnection(TABLE)
      .select('id')
      .whereNotNull('pickedUpAt') // Only consider activated loans (not pending)
      .whereNull('returnedAt') // Active if: not returned yet
      .whereRaw('keys LIKE ?', [`%"${keyId}"%`])

    // Exclude specific loan ID if provided (for update scenarios)
    if (excludeLoanId) {
      query = query.whereNot('id', excludeLoanId)
    }

    const activeLoan = await query.first()

    if (activeLoan) {
      conflictingKeys.push(keyId)
    }
  }

  return {
    hasConflict: conflictingKeys.length > 0,
    conflictingKeys,
  }
}

/**
 * Get key loans search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 */
export function getKeyLoansSearchQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*')
}
