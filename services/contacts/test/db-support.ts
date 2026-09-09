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
 * Empties `contact_relation` in the contacts test DB. Suites that commit real
 * rows (the e2e fixture; other suites may use a plain delete) call this so
 * the shared table is empty for suites that assume it is.
 */
export const resetContactRelations = async (db: Knex) => {
  requireContactsTestDb()
  await db('contact_relation').del()
}

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
