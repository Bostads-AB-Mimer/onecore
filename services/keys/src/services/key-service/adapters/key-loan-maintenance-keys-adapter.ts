import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type KeyLoanMaintenanceKeys = keys.v1.KeyLoanMaintenanceKeys
type CreateKeyLoanMaintenanceKeysRequest =
  keys.v1.CreateKeyLoanMaintenanceKeysRequest
type UpdateKeyLoanMaintenanceKeysRequest =
  keys.v1.UpdateKeyLoanMaintenanceKeysRequest

const TABLE = 'key_loan_maintenance_keys'

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
