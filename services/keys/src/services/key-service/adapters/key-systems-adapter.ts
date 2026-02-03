import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeySystem = keys.v1.KeySystem
type CreateKeySystemRequest = keys.v1.CreateKeySystemRequest
type UpdateKeySystemRequest = keys.v1.UpdateKeySystemRequest

const TABLE = 'key_systems'

export async function getKeySystemById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeySystem | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function createKeySystem(
  data: CreateKeySystemRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeySystem> {
  const [row] = await dbConnection(TABLE).insert(data).returning('*')
  return row
}

export async function updateKeySystem(
  id: string,
  data: UpdateKeySystemRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeySystem | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...data, updatedAt: dbConnection.fn.now() })
    .returning('*')
  return row
}

export async function deleteKeySystem(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

export async function getKeySystemBySystemCode(
  systemCode: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeySystem | undefined> {
  return await dbConnection(TABLE).where({ systemCode }).first()
}

/**
 * Get all key systems query builder for pagination
 * Returns a query builder that can be used with paginate()
 */
export function getAllKeySystemsQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

/**
 * Get key systems search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 */
export function getKeySystemsSearchQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*')
}

/**
 * Update key system with schema fileId after upload
 */
export async function updateKeySystemSchemaFileId(
  id: string,
  fileId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  await dbConnection(TABLE).where({ id }).update({
    schemaFileId: fileId,
    updatedAt: dbConnection.fn.now(),
  })
}

/**
 * Clear schema fileId from key system
 */
export async function clearKeySystemSchemaFileId(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  await dbConnection(TABLE).where({ id }).update({
    schemaFileId: null,
    updatedAt: dbConnection.fn.now(),
  })
}
