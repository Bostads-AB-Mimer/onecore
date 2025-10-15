import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type Key = keys.v1.Key
type CreateKeyRequest = keys.v1.CreateKeyRequest
type UpdateKeyRequest = keys.v1.UpdateKeyRequest

const TABLE = 'keys'

/**
 * Database adapter functions for keys.
 * These functions wrap database calls to make them easier to test.
 */

export async function getKeyById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getAllKeys(
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key[]> {
  return await dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

export async function getKeysByRentalObject(
  rentalObjectCode: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key[]> {
  return await dbConnection(TABLE)
    .where({ rentalObjectCode })
    .orderBy('keyName', 'asc')
}

export async function createKey(
  keyData: CreateKeyRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key> {
  const [row] = await dbConnection(TABLE).insert(keyData).returning('*')
  return row
}

export async function updateKey(
  id: string,
  keyData: UpdateKeyRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...keyData, updatedAt: dbConnection.fn.now() })
    .returning('*')

  return row
}

export async function deleteKey(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

export async function bulkUpdateFlexNumber(
  rentalObjectCode: string,
  flexNumber: number,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ rentalObjectCode }).update({
    flexNumber,
    updatedAt: dbConnection.fn.now(),
  })
}
