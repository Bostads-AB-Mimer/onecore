import { Knex } from 'knex'
import { createDbClient } from '../adapters/db'

export async function withContext(
  callback: (ctx: { db: Knex.Transaction }) => Promise<unknown>
) {
  const db = createDbClient()
  const trx = await db.transaction()
  try {
    await callback({ db: trx })
    await trx.rollback()
  } catch (e) {
    await trx.rollback()
    throw e
  } finally {
    await db.destroy()
  }
}
