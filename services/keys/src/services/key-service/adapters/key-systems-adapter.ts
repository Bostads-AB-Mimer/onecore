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
