import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeyBundle = keys.v1.KeyBundle
type CreateKeyBundleRequest = keys.v1.CreateKeyBundleRequest
type UpdateKeyBundleRequest = keys.v1.UpdateKeyBundleRequest

const TABLE = 'key_bundles'

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
