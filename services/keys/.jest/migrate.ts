import path from 'path'
import knex from 'knex'

import Config from '../src/common/config'

export default async function migrate() {
  const db = knex({
    client: 'mssql',
    connection: Config.keysDatabase,
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
