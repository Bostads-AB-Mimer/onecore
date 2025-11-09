import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan
type KeyLoanWithDetails = keys.v1.KeyLoanWithDetails
type CreateKeyLoanRequest = keys.v1.CreateKeyLoanRequest
type UpdateKeyLoanRequest = keys.v1.UpdateKeyLoanRequest

const TABLE = 'key_loans'
const KEYS_TABLE = 'keys'

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
      .whereNull('returnedAt') // Active if: not returned yet (regardless of pickup status)
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

export interface KeyLoansSearchOptions {
  /**
   * Search by key name, rental object code, contact, or contact2
   */
  keyNameOrObjectCode?: string

  /**
   * Minimum number of keys in loan
   */
  minKeys?: number

  /**
   * Maximum number of keys in loan
   */
  maxKeys?: number

  /**
   * Filter by pickedUpAt null status
   * - true: pickedUpAt IS NOT NULL
   * - false: pickedUpAt IS NULL
   * - undefined: no filter
   */
  hasPickedUp?: boolean

  /**
   * Filter by returnedAt null status
   * - true: returnedAt IS NOT NULL
   * - false: returnedAt IS NULL
   * - undefined: no filter
   */
  hasReturned?: boolean
}

/**
 * Get key loans search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 * @param options - Optional search filters
 * @param dbConnection - Database connection
 */
export function getKeyLoansSearchQuery(
  options: KeyLoansSearchOptions = {},
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  let query = dbConnection(TABLE).select(`${TABLE}.*`)

  // Filter by key name, rental object code, or contact
  if (options.keyNameOrObjectCode) {
    const searchTerm = `%${options.keyNameOrObjectCode}%`

    query = query.where(function () {
      // Search in keys (keyName or rentalObjectCode)
      this.whereRaw(
        `EXISTS (
          SELECT 1
          FROM ?? k
          CROSS APPLY OPENJSON(??) AS keyIds
          WHERE k.id = TRY_CAST(keyIds.value AS uniqueidentifier)
          AND (k.keyName LIKE ? OR k.rentalObjectCode LIKE ?)
        )`,
        [KEYS_TABLE, `${TABLE}.keys`, searchTerm, searchTerm]
      )
        // OR search in contact fields
        .orWhere(`${TABLE}.contact`, 'like', searchTerm)
        .orWhere(`${TABLE}.contact2`, 'like', searchTerm)
    })
  }

  // Filter by minimum number of keys
  if (options.minKeys !== undefined && options.minKeys > 0) {
    query = query.whereRaw(
      `(SELECT COUNT(*) FROM OPENJSON(${TABLE}.keys)) >= ?`,
      [options.minKeys]
    )
  }

  // Filter by maximum number of keys
  if (options.maxKeys !== undefined && options.maxKeys > 0) {
    query = query.whereRaw(
      `(SELECT COUNT(*) FROM OPENJSON(${TABLE}.keys)) <= ?`,
      [options.maxKeys]
    )
  }

  // Filter by pickedUpAt null status
  if (options.hasPickedUp === true) {
    query = query.whereNotNull(`${TABLE}.pickedUpAt`)
  } else if (options.hasPickedUp === false) {
    query = query.whereNull(`${TABLE}.pickedUpAt`)
  }

  // Filter by returnedAt null status
  if (options.hasReturned === true) {
    query = query.whereNotNull(`${TABLE}.returnedAt`)
  } else if (options.hasReturned === false) {
    query = query.whereNull(`${TABLE}.returnedAt`)
  }

  return query
}

/**
 * Get enriched key loans for a rental object with keys and optionally receipts in a single optimized query.
 * This eliminates N+1 queries by fetching all data in one go.
 *
 * @param rentalObjectCode - The rental object code to filter by
 * @param contact - Optional first contact code to filter by
 * @param contact2 - Optional second contact code to filter by
 * @param includeReceipts - Whether to include receipts (default: false)
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection (optional, defaults to db)
 * @returns Promise<KeyLoanWithDetails[]> - Key loans with enriched keys and optionally receipts data
 */
export async function getKeyLoansByRentalObject(
  rentalObjectCode: string,
  contact?: string,
  contact2?: string,
  includeReceipts = false,
  returned?: boolean,
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

  // Filter by returned status
  if (returned === true) {
    loansQuery = loansQuery.whereNotNull('kl.returnedAt')
  } else if (returned === false) {
    loansQuery = loansQuery.whereNull('kl.returnedAt')
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

/**
 * Get key loans by contact (works for both TENANT and MAINTENANCE loan types)
 * For MAINTENANCE loans, company name is stored in the contact field
 * @param contact - The contact/company name
 * @param loanType - Optional loan type filter ('TENANT' or 'MAINTENANCE')
 * @param dbConnection - Database connection
 * @returns Array of key loans
 */
export async function getKeyLoansByContact(
  contact: string,
  loanType?: 'TENANT' | 'MAINTENANCE',
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  let query = dbConnection(TABLE).where({ contact })

  if (loanType) {
    query = query.where({ loanType })
  }

  return await query.orderBy('id', 'desc')
}

/**
 * Get key loans by contact with full key details
 * @param contact - The contact/company name to filter by
 * @param loanType - Optional loan type filter ('TENANT' or 'MAINTENANCE')
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection
 * @returns Array of loans with keysArray containing full key objects
 */
export async function getKeyLoansWithKeysByContact(
  contact: string,
  loanType: 'TENANT' | 'MAINTENANCE' | undefined,
  returned: boolean | undefined,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanWithDetails[]> {
  // Build base query
  let query = dbConnection(TABLE).where({ contact })

  if (loanType) {
    query = query.where({ loanType })
  }

  if (returned === true) {
    query = query.whereNotNull('returnedAt')
  } else if (returned === false) {
    query = query.whereNull('returnedAt')
  }

  const loans = await query.orderBy('id', 'desc')

  // For each loan, parse the keys JSON and fetch full key details
  const loansWithKeys = await Promise.all(
    loans.map(async (loan) => {
      let keyIds: string[] = []
      try {
        keyIds = JSON.parse(loan.keys)
      } catch (_e) {
        // If parsing fails, return empty array
        keyIds = []
      }

      // Fetch all keys for this loan
      const keysArray =
        keyIds.length > 0
          ? await dbConnection(KEYS_TABLE).whereIn('id', keyIds).select('*')
          : []

      return {
        ...loan,
        keysArray,
        receipts: [], // Include empty receipts array to match type
      } as KeyLoanWithDetails
    })
  )

  return loansWithKeys
}

/**
 * Get key loans by key bundle with full key details (works for all loan types)
 * Finds all loans that contain at least one key from the specified bundle
 * @param bundleId - The key bundle ID to filter by
 * @param loanType - Optional loan type filter ('TENANT' or 'MAINTENANCE')
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection
 * @returns Array of loans with keysArray containing full key objects
 */
export async function getKeyLoansWithKeysByBundle(
  bundleId: string,
  loanType: 'TENANT' | 'MAINTENANCE' | undefined,
  returned: boolean | undefined,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanWithDetails[]> {
  // First, get the key bundle to find which keys it contains
  const bundle = await dbConnection('key_bundles')
    .where({ id: bundleId })
    .first()

  if (!bundle) {
    return []
  }

  // Parse the bundle's keys
  let bundleKeyIds: string[] = []
  try {
    bundleKeyIds = JSON.parse(bundle.keys)
  } catch (_e) {
    return []
  }

  if (bundleKeyIds.length === 0) {
    return []
  }

  // Build base query to find loans containing any of these keys
  let query = dbConnection(TABLE)

  // Filter by loan type if specified
  if (loanType) {
    query = query.where({ loanType })
  }

  // Use OR conditions to match any key in the bundle
  query = query.where(function () {
    bundleKeyIds.forEach((keyId) => {
      this.orWhereRaw('keys LIKE ?', [`%"${keyId}"%`])
    })
  })

  // Apply returnedAt filter
  if (returned === true) {
    query = query.whereNotNull('returnedAt')
  } else if (returned === false) {
    query = query.whereNull('returnedAt')
  }

  const loans = await query.orderBy('id', 'desc')

  // For each loan, parse the keys JSON and fetch full key details
  const loansWithKeys = await Promise.all(
    loans.map(async (loan) => {
      let keyIds: string[] = []
      try {
        keyIds = JSON.parse(loan.keys)
      } catch (_e) {
        keyIds = []
      }

      // Fetch all keys for this loan
      const keysArray =
        keyIds.length > 0
          ? await dbConnection(KEYS_TABLE).whereIn('id', keyIds).select('*')
          : []

      return {
        ...loan,
        keysArray,
        receipts: [], // Include empty receipts array to match type
      } as KeyLoanWithDetails
    })
  )

  return loansWithKeys
}
