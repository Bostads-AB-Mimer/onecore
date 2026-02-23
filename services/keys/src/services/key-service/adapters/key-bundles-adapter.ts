import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import { getKeyDetailsById, type KeyIncludeOptions } from './keys-adapter'

type KeyBundle = keys.KeyBundle
type KeyDetails = keys.KeyDetails
type BundleWithLoanedKeysInfo = keys.BundleWithLoanedKeysInfo
type CreateKeyBundleRequest = keys.CreateKeyBundleRequest
type UpdateKeyBundleRequest = keys.UpdateKeyBundleRequest

const TABLE = 'key_bundles'
const JUNCTION_TABLE = 'key_bundle_keys'
const KEY_LOANS_TABLE = 'key_loans'

/**
 * Database adapter functions for key bundles.
 * Keys are stored in the key_bundle_keys junction table, not on the bundle entity.
 */

/**
 * Helper to add keyCount subquery to a query builder.
 */
function withKeyCount(
  query: Knex.QueryBuilder,
  dbConnection: Knex | Knex.Transaction
): Knex.QueryBuilder {
  return query.select(
    dbConnection.raw(
      `(SELECT COUNT(*) FROM ${JUNCTION_TABLE} WHERE keyBundleId = ${TABLE}.id) as keyCount`
    )
  )
}

/**
 * Returns a query builder for fetching all key bundles.
 * Use this with the paginate utility for paginated results.
 */
export function getAllKeyBundlesQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return withKeyCount(
    dbConnection(TABLE).select(`${TABLE}.*`).orderBy('name', 'asc'),
    dbConnection
  )
}

export async function getAllKeyBundles(
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle[]> {
  return await getAllKeyBundlesQuery(dbConnection)
}

export async function getKeyBundleById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle | undefined> {
  return await withKeyCount(
    dbConnection(TABLE).where({ id }),
    dbConnection
  ).first()
}

export async function getKeyBundlesByKeyId(
  keyId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyBundle[]> {
  return await dbConnection(TABLE)
    .join(JUNCTION_TABLE, `${TABLE}.id`, `${JUNCTION_TABLE}.keyBundleId`)
    .where(`${JUNCTION_TABLE}.keyId`, keyId)
    .select(`${TABLE}.*`)
    .orderBy('name', 'asc')
}

export async function createKeyBundle(
  keyBundleData: CreateKeyBundleRequest,
  dbConnection: Knex = db
): Promise<KeyBundle> {
  const { keys: keyIds, ...bundleData } = keyBundleData

  return dbConnection.transaction(async (trx) => {
    const [row] = await trx(TABLE).insert(bundleData).returning('*')

    if (keyIds?.length) {
      const uniqueKeyIds = [...new Set(keyIds)]
      await trx(JUNCTION_TABLE).insert(
        uniqueKeyIds.map((keyId) => ({ keyBundleId: row.id, keyId }))
      )
    }

    return row
  })
}

export async function updateKeyBundle(
  id: string,
  keyBundleData: UpdateKeyBundleRequest,
  dbConnection: Knex = db
): Promise<KeyBundle | undefined> {
  const { keys: keyIds, ...bundleData } = keyBundleData

  return dbConnection.transaction(async (trx) => {
    const [row] = await trx(TABLE)
      .where({ id })
      .update(bundleData)
      .returning('*')

    if (keyIds !== undefined) {
      await trx(JUNCTION_TABLE).where({ keyBundleId: id }).del()
      if (keyIds.length) {
        const uniqueKeyIds = [...new Set(keyIds)]
        await trx(JUNCTION_TABLE).insert(
          uniqueKeyIds.map((keyId) => ({ keyBundleId: id, keyId }))
        )
      }
    }

    return row
  })
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
  return withKeyCount(dbConnection(TABLE).select(`${TABLE}.*`), dbConnection)
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

  // 2. Get key IDs from junction table
  const keyIds = (
    await dbConnection(JUNCTION_TABLE)
      .where({ keyBundleId: bundleId })
      .select('keyId')
  ).map((r) => r.keyId)

  if (keyIds.length === 0) {
    return { bundle, keys: [] }
  }

  // 3. Fetch all keys and enrich with related data in one call
  const validKeys = await getKeyDetailsById(keyIds, dbConnection, options)

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

  // Collect all key IDs from all active loans via junction table
  const loanIds = activeLoans.map((l) => l.id)
  const loanKeyRows = await dbConnection('key_loan_keys')
    .whereIn('keyLoanId', loanIds)
    .select('keyId')
  const loanedKeyIds = new Set<string>(loanKeyRows.map((r) => r.keyId))

  if (loanedKeyIds.size === 0) {
    return []
  }

  // Get all bundle-key mappings in one query
  const allBundleKeyRows = await dbConnection(JUNCTION_TABLE).select(
    'keyBundleId',
    'keyId'
  )

  // Build Map<bundleId, keyId[]>
  const keysByBundle = new Map<string, string[]>()
  for (const row of allBundleKeyRows) {
    if (!keysByBundle.has(row.keyBundleId)) {
      keysByBundle.set(row.keyBundleId, [])
    }
    keysByBundle.get(row.keyBundleId)!.push(row.keyId)
  }

  // Get all bundles
  const allBundles = await dbConnection(TABLE).select('*')

  // For each bundle, check if it has any loaned keys
  const bundlesWithLoanedKeys: BundleWithLoanedKeysInfo[] = []

  for (const bundle of allBundles) {
    const bundleKeyIds = keysByBundle.get(bundle.id) || []

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
