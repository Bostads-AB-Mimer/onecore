import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeyBundle = keys.v1.KeyBundle
type KeyWithMaintenanceLoanStatus = keys.v1.KeyWithMaintenanceLoanStatus
type CreateKeyBundleRequest = keys.v1.CreateKeyBundleRequest
type UpdateKeyBundleRequest = keys.v1.UpdateKeyBundleRequest

const TABLE = 'key_bundles'
const KEYS_TABLE = 'keys'
const MAINTENANCE_LOANS_TABLE = 'key_loan_maintenance_keys'

/**
 * Database adapter functions for key bundles.
 * These functions wrap database calls to make them easier to test.
 */

export async function getAllKeyBundles(
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle[]> {
  return await dbConnection(TABLE).select('*').orderBy('name', 'asc')
}

export async function getKeyBundleById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getKeyBundlesByKeyId(
  keyId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle[]> {
  return await dbConnection(TABLE)
    .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
    .orderBy('name', 'asc')
}

export async function createKeyBundle(
  keyBundleData: CreateKeyBundleRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle> {
  const [row] = await dbConnection(TABLE).insert(keyBundleData).returning('*')
  return row
}

export async function updateKeyBundle(
  id: string,
  keyBundleData: UpdateKeyBundleRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update(keyBundleData)
    .returning('*')

  return row
}

export async function deleteKeyBundle(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

/**
 * Get key bundles search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 */
export function getKeyBundlesSearchQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*')
}

/**
 * Get all keys in a bundle with their current maintenance loan status
 * Returns all keys in the bundle with information about any active maintenance loans
 *
 * @param bundleId - The key bundle ID
 * @param dbConnection - Database connection
 * @returns Promise with bundle info and keys with loan status
 */
export async function getKeyBundleWithLoanStatus(
  bundleId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{
  bundle: KeyBundle
  keys: KeyWithMaintenanceLoanStatus[]
}> {
  // 1. Get the bundle
  const bundle = await dbConnection(TABLE).where({ id: bundleId }).first()

  if (!bundle) {
    throw new Error('Bundle not found')
  }

  // 2. Parse key IDs from bundle
  let keyIds: string[] = []
  try {
    keyIds = JSON.parse(bundle.keys)
  } catch (_e) {
    keyIds = []
  }

  if (keyIds.length === 0) {
    return { bundle, keys: [] }
  }

  // 3. For each key, find if it's in any active maintenance loan
  const keys: (KeyWithMaintenanceLoanStatus | null)[] = await Promise.all(
    keyIds.map(async (keyId) => {
      const key = await dbConnection(KEYS_TABLE).where({ id: keyId }).first()

      if (!key) {
        // Key not found, skip
        return null
      }

      // Find active loan containing this specific key
      const activeLoan = await dbConnection(MAINTENANCE_LOANS_TABLE)
        .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
        .whereNull('returnedAt')
        .first()

      return {
        ...key,
        maintenanceLoanId: activeLoan?.id || null,
        maintenanceLoanCompany: activeLoan?.company || null,
        maintenanceLoanContactPerson: activeLoan?.contactPerson || null,
        maintenanceLoanPickedUpAt: activeLoan?.pickedUpAt || null,
        maintenanceLoanCreatedAt: activeLoan?.createdAt || null,
      } as KeyWithMaintenanceLoanStatus
    })
  )

  // Filter out nulls (keys that weren't found)
  const validKeys = keys.filter(
    (k): k is KeyWithMaintenanceLoanStatus => k !== null
  )

  return { bundle, keys: validKeys }
}
