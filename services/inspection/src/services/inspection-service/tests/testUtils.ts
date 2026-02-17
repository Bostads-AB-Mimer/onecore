import { Knex } from 'knex'
import { createDbClient } from '../adapters/db'

export async function withContext(
  callback: (ctx: { db: Knex.Transaction }) => Promise<unknown>
) {
  const db = createDbClient()
  try {
    await db.transaction(async (trx) => {
      await callback({
        db: trx,
      })

      throw 'rollback'
    })
  } catch (e: unknown) {
    if (e === 'rollback') return e
    throw e
  } finally {
    await db.destroy()
  }
}
