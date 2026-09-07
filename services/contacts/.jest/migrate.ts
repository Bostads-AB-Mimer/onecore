import 'dotenv/config'
import path from 'path'
import knex from 'knex'

/**
 * Jest globalSetup: applies knex migrations to the contacts test database
 * before any tests run. Covers `test`, `test:ci`, `test:watch` and direct
 * IDE/jest invocations alike.
 */
export default async function migrate() {
  const database = process.env.CONTACTS_DATABASE__DATABASE

  if (database !== 'contacts-test') {
    throw new Error(
      `Refusing to migrate database "${database}". Must be "contacts-test".`
    )
  }

  const db = knex({
    client: 'mssql',
    connection: {
      host: process.env.CONTACTS_DATABASE__HOST,
      database,
      user: process.env.CONTACTS_DATABASE__USER,
      password: process.env.CONTACTS_DATABASE__PASSWORD,
      port: parseInt(process.env.CONTACTS_DATABASE__PORT ?? '', 10),
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, '../migrations'),
    },
  })

  try {
    await db.migrate.latest()
  } finally {
    await db.destroy()
  }
}
