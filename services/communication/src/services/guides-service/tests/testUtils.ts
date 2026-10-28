import knex, { Knex } from 'knex'

import Config from '../../../common/config'

function createDbClient(): Knex {
  return knex({
    client: 'mssql',
    connection: Config.communicationDatabase,
    useNullAsDefault: true,
  })
}

/**
 * Run a test inside a database transaction that is always rolled back, so
 * tests never leave rows behind. Adapters take the transaction as their
 * `db` argument.
 */
export async function withContext(
  callback: (ctx: { db: Knex.Transaction }) => Promise<unknown>
) {
  const db = createDbClient()
  try {
    await db.transaction(async (trx) => {
      await callback({ db: trx })
      throw 'rollback'
    })
  } catch (e: unknown) {
    if (e === 'rollback') return e
    throw e
  } finally {
    await db.destroy()
  }
}
