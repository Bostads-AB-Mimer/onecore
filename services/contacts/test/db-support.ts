import { Knex } from 'knex'
import config from '@src/common/config'

const requireDatabase = (actual: string, expected: string) => {
  if (actual !== expected) {
    throw new Error(
      `Refusing to run against database "${actual}". Must be "${expected}".`
    )
  }
}

/** Call at module scope in any suite that touches the contacts database. */
export const requireContactsTestDb = () =>
  requireDatabase(config.contactsDatabase.database, 'contacts-test')

/** Call at module scope in any suite that writes to the Xpand test database. */
export const requireXpandTestDb = () =>
  requireDatabase(config.xpandDatabase.database, 'contacts-xpand-test')

/**
 * Wraps each case in a transaction that is always rolled back, so cases
 * neither see nor leave each other's rows.
 */
export const makeWithContext =
  (dbResource: { get: () => Knex }) =>
  async (callback: (ctx: { db: Knex.Transaction }) => Promise<unknown>) => {
    try {
      await dbResource.get().transaction(async (trx) => {
        await callback({ db: trx })

        throw 'rollback'
      })
    } catch (e: unknown) {
      if (e === 'rollback') return
      throw e
    }
  }
