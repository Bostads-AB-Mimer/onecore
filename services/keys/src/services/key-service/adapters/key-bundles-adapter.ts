import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import { getKeyDetails, type KeyIncludeOptions } from './keys-adapter'

type KeyBundle = keys.v1.KeyBundle
type KeyDetails = keys.v1.KeyDetails
type Key = keys.v1.Key
type BundleWithLoanedKeysInfo = keys.v1.BundleWithLoanedKeysInfo
type CreateKeyBundleRequest = keys.v1.CreateKeyBundleRequest
type UpdateKeyBundleRequest = keys.v1.UpdateKeyBundleRequest

const TABLE = 'key_bundles'
const KEYS_TABLE = 'keys'
const KEY_LOANS_TABLE = 'key_loans'

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
 * Get all keys in a bundle with optional related data
 * Returns all keys in the bundle with optional information about loans, events, and key systems
 *
 * @param bundleId - The key bundle ID
 * @param options - Options for including related data (loans, events, keySystem)
 * @param dbConnection - Database connection
 * @returns Promise with bundle info and keys with optional details
 */
export async function getKeyBundleDetails(
  bundleId: string,
  options: KeyIncludeOptions = {},
  dbConnection: Knex | Knex.Transaction = db
): Promise<{
  bundle: KeyBundle
  keys: KeyDetails[]
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

  // 3. For each key, fetch it and optionally enrich with related data
  const keys: (KeyDetails | null)[] = await Promise.all(
    keyIds.map(async (keyId) => {
      // Fetch base key
      const key = (await dbConnection(KEYS_TABLE)
        .where({ id: keyId })
        .first()) as Key | undefined

      if (!key) {
        return null
      }

      // Use centralized helper to enrich with optional relations
      return await getKeyDetails(key, dbConnection, options)
    })
  )

  // Filter out nulls (keys that weren't found)
  const validKeys = keys.filter((k): k is KeyDetails => k !== null)

  return { bundle, keys: validKeys }
}

/**
 * Get all key bundles that have keys loaned to a specific contact
 */
export async function getKeyBundlesByContactWithLoanedKeys(
  contactCode: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<BundleWithLoanedKeysInfo[]> {
  // Find all active MAINTENANCE loans for this contact (using unified key_loans table)
  const activeLoans = await dbConnection(KEY_LOANS_TABLE)
    .where({ contact: contactCode, loanType: 'MAINTENANCE' })
    .whereNull('returnedAt')

  if (activeLoans.length === 0) {
    return []
  }

  // Collect all key IDs from all active loans
  const loanedKeyIds = new Set<string>()
  for (const loan of activeLoans) {
    try {
      const keyIds: string[] = JSON.parse(loan.keys)
      keyIds.forEach((id) => loanedKeyIds.add(id))
    } catch (_e) {
      // Skip invalid JSON
    }
  }

  if (loanedKeyIds.size === 0) {
    return []
  }

  // Get all bundles
  const allBundles = await dbConnection(TABLE).select('*')

  // For each bundle, check if it has any loaned keys
  const bundlesWithLoanedKeys: BundleWithLoanedKeysInfo[] = []

  for (const bundle of allBundles) {
    let bundleKeyIds: string[] = []
    try {
      bundleKeyIds = JSON.parse(bundle.keys)
    } catch (_e) {
      continue
    }

    // Count how many keys from this bundle are loaned to the contact
    const loanedKeysInBundle = bundleKeyIds.filter((keyId) =>
      loanedKeyIds.has(keyId)
    )

    if (loanedKeysInBundle.length > 0) {
      bundlesWithLoanedKeys.push({
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        loanedKeyCount: loanedKeysInBundle.length,
        totalKeyCount: bundleKeyIds.length,
      })
    }
  }

  // Sort by name
  bundlesWithLoanedKeys.sort((a, b) => a.name.localeCompare(b.name))

  return bundlesWithLoanedKeys
}
