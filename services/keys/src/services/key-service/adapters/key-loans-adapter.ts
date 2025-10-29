import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import { parseAndSyncKeyLoanItems } from './junction-table-helpers'

type KeyLoan = keys.v1.KeyLoan
type KeyLoanWithDetails = keys.v1.KeyLoanWithDetails
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
  // Use junction table for indexed lookup instead of LIKE pattern
  return await dbConnection(TABLE)
    .select('key_loans.*')
    .innerJoin('key_loan_items', 'key_loan_items.keyLoanId', 'key_loans.id')
    .where('key_loan_items.keyId', keyId)
    .orderBy('key_loans.createdAt', 'desc')
}

export async function createKeyLoan(
  keyLoanData: CreateKeyLoanRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan> {
  const [row] = await dbConnection(TABLE).insert(keyLoanData).returning('*')

  // Sync junction table with JSON keys array
  if (row && row.keys) {
    await parseAndSyncKeyLoanItems(row.id, row.keys, dbConnection)
  }

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

  // Sync junction table with JSON keys array if keys were updated
  if (row && row.keys) {
    await parseAndSyncKeyLoanItems(row.id, row.keys, dbConnection)
  }

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
 * Uses junction table for efficient indexed lookup (eliminates N+1 queries)
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

  // Use junction table to find all conflicting keys in a single query
  let query = dbConnection('key_loan_items')
    .select('key_loan_items.keyId')
    .distinct()
    .innerJoin('key_loans', 'key_loans.id', 'key_loan_items.keyLoanId')
    .whereIn('key_loan_items.keyId', keyIds)
    .whereNotNull('key_loans.pickedUpAt') // Only consider activated loans (not pending)
    .whereNull('key_loans.returnedAt') // Active if: not returned yet

  // Exclude specific loan ID if provided (for update scenarios)
  if (excludeLoanId) {
    query = query.whereNot('key_loans.id', excludeLoanId)
  }

  const conflicts = await query
  const conflictingKeys = conflicts.map((row) => row.keyId)

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

/**
 * Get enriched key loans for a rental object with keys and optionally receipts in a single optimized query.
 * This eliminates N+1 queries by fetching all data in one go.
 *
 * @param rentalObjectCode - The rental object code to filter by
 * @param contact - Optional first contact code to filter by
 * @param contact2 - Optional second contact code to filter by
 * @param includeReceipts - Whether to include receipts (default: false)
 * @param dbConnection - Database connection (optional, defaults to db)
 * @returns Promise<KeyLoanWithDetails[]> - Key loans with enriched keys and optionally receipts data
 */
export async function getKeyLoansByRentalObject(
  rentalObjectCode: string,
  contact?: string,
  contact2?: string,
  includeReceipts = false,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanWithDetails[]> {
  // Step 1: Get all key loans for the rental object (filtered by contacts if provided)
  // Use junction table for efficient indexed lookup
  let loansQuery = dbConnection('key_loans as kl')
    .select('kl.*')
    .distinct()
    .innerJoin('key_loan_items as kli', 'kli.keyLoanId', 'kl.id')
    .innerJoin('keys as k', 'k.id', 'kli.keyId')
    .where('k.rentalObjectCode', rentalObjectCode)
    .orderBy('kl.createdAt', 'desc')

  // Filter by contacts: match if ANY provided contact matches EITHER kl.contact OR kl.contact2
  if (contact || contact2) {
    loansQuery = loansQuery.where(function () {
      if (contact && contact2) {
        // Both contacts provided: (kl.contact IN (c1,c2)) OR (kl.contact2 IN (c1,c2))
        this.whereIn('kl.contact', [contact, contact2]).orWhereIn(
          'kl.contact2',
          [contact, contact2]
        )
      } else if (contact) {
        // Only contact provided
        this.where('kl.contact', contact).orWhere('kl.contact2', contact)
      } else if (contact2) {
        // Only contact2 provided
        this.where('kl.contact', contact2).orWhere('kl.contact2', contact2)
      }
    })
  }

  const loans = await loansQuery

  if (loans.length === 0) {
    return []
  }

  const loanIds = loans.map((l) => l.id)

  // Step 2: Get all keys for these loans
  const allKeyIds = new Set<string>()
  loans.forEach((loan) => {
    try {
      const keyIds: string[] = JSON.parse(loan.keys || '[]')
      keyIds.forEach((id) => allKeyIds.add(id))
    } catch {
      // Skip malformed JSON
    }
  })

  const keys =
    allKeyIds.size > 0
      ? await dbConnection('keys')
          .whereIn('id', Array.from(allKeyIds))
          .select('*')
      : []

  const keyMap = new Map(keys.map((k) => [k.id, k]))

  // Step 3: Get receipts for these loans (max 2 per loan: LOAN and RETURN) - only if requested
  const receiptsByLoan = new Map<string, any[]>()
  if (includeReceipts) {
    const receiptsResult = await dbConnection.raw(
      `
      SELECT r.*
      FROM receipts r
      INNER JOIN (
        SELECT keyLoanId, receiptType, MAX(createdAt) as latestCreated
        FROM receipts
        WHERE keyLoanId IN (${loanIds.map(() => '?').join(',')})
        GROUP BY keyLoanId, receiptType
      ) latest ON r.keyLoanId = latest.keyLoanId
        AND r.receiptType = latest.receiptType
        AND r.createdAt = latest.latestCreated
      ORDER BY r.createdAt DESC
      `,
      loanIds
    )

    const receipts = receiptsResult as any[]
    receipts.forEach((receipt) => {
      if (!receiptsByLoan.has(receipt.keyLoanId)) {
        receiptsByLoan.set(receipt.keyLoanId, [])
      }
      receiptsByLoan.get(receipt.keyLoanId)!.push(receipt)
    })
  }

  // Step 4: Combine everything
  return loans.map((loan) => {
    const keyIds: string[] = JSON.parse(loan.keys || '[]')
    const keysArray = keyIds
      .map((id) => keyMap.get(id))
      .filter((k): k is (typeof keys)[0] => k !== undefined)
    const loanReceipts = receiptsByLoan.get(loan.id) || []

    return {
      ...loan,
      keysArray,
      receipts: loanReceipts,
    }
  })
}
