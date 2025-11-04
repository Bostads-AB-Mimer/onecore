import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

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
 * Check if any of the provided keys have active loans in EITHER regular loans OR maintenance loans
 * @param keyIds - Array of key IDs to check
 * @param excludeRegularLoanId - Optional regular loan ID to exclude from the check (for updates)
 * @param excludeMaintenanceLoanId - Optional maintenance loan ID to exclude from the check (for updates)
 * @param dbConnection - Database connection
 * @returns Object with hasConflict flag, conflicting key IDs, and details about conflict types
 */
export async function checkActiveKeyLoansAcrossAllTypes(
  keyIds: string[],
  excludeRegularLoanId?: string,
  excludeMaintenanceLoanId?: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{
  hasConflict: boolean
  conflictingKeys: string[]
  conflictDetails: { keyId: string; conflictType: 'regular' | 'maintenance' }[]
}> {
  if (keyIds.length === 0) {
    return { hasConflict: false, conflictingKeys: [], conflictDetails: [] }
  }

  const conflictDetails: {
    keyId: string
    conflictType: 'regular' | 'maintenance'
  }[] = []

  // Check each key ID for active loans in both tables
  for (const keyId of keyIds) {
    // Check regular loans (key_loans table)
    let regularQuery = dbConnection('key_loans')
      .select('id')
      .whereNotNull('pickedUpAt') // Only activated loans
      .whereNull('returnedAt') // Not yet returned
      .whereRaw('keys LIKE ?', [`%"${keyId}"%`])

    if (excludeRegularLoanId) {
      regularQuery = regularQuery.whereNot('id', excludeRegularLoanId)
    }

    const regularLoan = await regularQuery.first()

    // Check maintenance loans (key_loan_maintenance_keys table)
    let maintenanceQuery = dbConnection('key_loan_maintenance_keys')
      .select('id')
      .whereNull('returnedAt') // Not yet returned
      .whereRaw('keys LIKE ?', [`%"${keyId}"%`])

    if (excludeMaintenanceLoanId) {
      maintenanceQuery = maintenanceQuery.whereNot(
        'id',
        excludeMaintenanceLoanId
      )
    }

    const maintenanceLoan = await maintenanceQuery.first()

    // Record conflicts
    if (regularLoan) {
      conflictDetails.push({ keyId, conflictType: 'regular' })
    }
    if (maintenanceLoan) {
      conflictDetails.push({ keyId, conflictType: 'maintenance' })
    }
  }

  const conflictingKeys = [...new Set(conflictDetails.map((d) => d.keyId))]

  return {
    hasConflict: conflictDetails.length > 0,
    conflictingKeys,
    conflictDetails,
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
  let loansQuery = dbConnection('key_loans as kl')
    .select('kl.*')
    .whereExists(function () {
      this.select(dbConnection.raw('1'))
        .from('keys as k')
        .whereRaw("kl.keys LIKE '%\"' + CAST(k.id AS NVARCHAR(36)) + '\"%'")
        .where('k.rentalObjectCode', rentalObjectCode)
    })
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
