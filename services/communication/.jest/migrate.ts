import path from 'path'
import knex from 'knex'
import * as dotenv from 'dotenv'

// globalSetup runs in its own process, so load the test env explicitly.
dotenv.config({ path: path.join(__dirname, '../.env.test') })

export default async function migrate() {
  const db = knex({
    client: 'mssql',
    connection: {
      host: process.env.COMMUNICATION_DATABASE__HOST,
      user: process.env.COMMUNICATION_DATABASE__USER,
      password: process.env.COMMUNICATION_DATABASE__PASSWORD,
      database: process.env.COMMUNICATION_DATABASE__DATABASE,
      port: Number(process.env.COMMUNICATION_DATABASE__PORT),
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, '../migrations'),
    },
  })

  await db.migrate
    .latest()
    .then(() => {
      console.log('Migrations applied')
    })
    .catch((error) => {
      console.error('Error applying migrations', error)
      process.exit(1)
    })

  await db.destroy()
}
