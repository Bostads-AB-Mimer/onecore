import path from 'path'
import knex from 'knex'

import Config from '../src/common/config'

export default async function migrate() {
  const db = knex({
    client: 'mssql',
    connection: Config.leasingDatabase,
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
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
    })

  await db.destroy()
}
