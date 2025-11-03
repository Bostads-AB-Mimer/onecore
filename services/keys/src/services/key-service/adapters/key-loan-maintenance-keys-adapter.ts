import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeyLoanMaintenanceKeys = keys.v1.KeyLoanMaintenanceKeys
type KeyLoanMaintenanceKeysWithDetails =
  keys.v1.KeyLoanMaintenanceKeysWithDetails
type CreateKeyLoanMaintenanceKeysRequest =
  keys.v1.CreateKeyLoanMaintenanceKeysRequest
type UpdateKeyLoanMaintenanceKeysRequest =
  keys.v1.UpdateKeyLoanMaintenanceKeysRequest

const TABLE = 'key_loan_maintenance_keys'
const KEYS_TABLE = 'keys'

/**
 * Database adapter functions for key loan maintenance keys.
 * These functions wrap database calls to make them easier to test.
 */

export async function getAllKeyLoanMaintenanceKeys(
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeys[]> {
  return await dbConnection(TABLE).select('*').orderBy('id', 'desc')
}

export async function getKeyLoanMaintenanceKeyById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeys | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getKeyLoanMaintenanceKeysByKeyId(
  keyId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeys[]> {
  return await dbConnection(TABLE)
    .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
    .orderBy('id', 'desc')
}

export async function getKeyLoanMaintenanceKeysByCompany(
  company: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeys[]> {
  return await dbConnection(TABLE).where({ company }).orderBy('id', 'desc')
}

export async function createKeyLoanMaintenanceKey(
  keyLoanData: CreateKeyLoanMaintenanceKeysRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeys> {
  const [row] = await dbConnection(TABLE).insert(keyLoanData).returning('*')
  return row
}

export async function updateKeyLoanMaintenanceKey(
  id: string,
  keyLoanData: UpdateKeyLoanMaintenanceKeysRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeys | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update(keyLoanData)
    .returning('*')

  return row
}

export async function deleteKeyLoanMaintenanceKey(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

/**
 * Get key loan maintenance keys search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 */
export function getKeyLoanMaintenanceKeysSearchQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*')
}

/**
 * Get maintenance key loans by company with full key details
 * @param company - The company name to filter by
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection
 * @returns Array of loans with keysArray containing full key objects
 */
export async function getKeyLoanMaintenanceKeysWithKeysByCompany(
  company: string,
  returned: boolean | undefined,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeysWithDetails[]> {
  // Build base query with optional returnedAt filter
  let query = dbConnection(TABLE).where({ company })

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
      } as KeyLoanMaintenanceKeysWithDetails
    })
  )

  return loansWithKeys
}

/**
 * Get maintenance key loans by key bundle with full key details
 * Finds all loans that contain at least one key from the specified bundle
 * @param bundleId - The key bundle ID to filter by
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection
 * @returns Array of loans with keysArray containing full key objects
 */
export async function getKeyLoanMaintenanceKeysWithKeysByBundle(
  bundleId: string,
  returned: boolean | undefined,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanMaintenanceKeysWithDetails[]> {
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
      } as KeyLoanMaintenanceKeysWithDetails
    })
  )

  return loansWithKeys
}
