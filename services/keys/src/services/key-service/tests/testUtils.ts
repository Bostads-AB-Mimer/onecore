import { Knex } from 'knex'
import knex from 'knex'
import Config from '../../../common/config'

function createDbClient(): Knex {
  return knex({
    client: 'mssql',
    connection: Config.keysDatabase,
    useNullAsDefault: true,
  })
}

/**
 * Utility function to run tests in an isolated database transaction
 * that is automatically rolled back after the test completes.
 *
 * This ensures:
 * - Tests don't pollute the database
 * - Tests can run in parallel (with maxWorkers: 1 for safety)
 * - No need to manually clean up test data
 *
 * @example
 * it('creates a key', () =>
 *   withContext(async (ctx) => {
 *     const key = await createKey(factory.key.build(), ctx.db)
 *     expect(key).toBeDefined()
 *   }))
 */
export async function withContext(
  callback: (ctx: { db: Knex.Transaction }) => Promise<unknown>
) {
  const db = createDbClient()
  try {
    await db.transaction(async (trx) => {
      await callback({
        db: trx,
      })

      // Always rollback to keep tests isolated
      throw 'rollback'
    })
  } catch (e: unknown) {
    if (e === 'rollback') return e
    throw e
  } finally {
    await db.destroy()
  }
}
