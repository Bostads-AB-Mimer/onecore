import path from 'path'
import knex from 'knex'

import Config from '../src/common/config'

export default async function teardown() {
  const db = knex({
    client: 'mssql',
    connection: Config.leasingDatabase,
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      directory: path.join(__dirname, '../migrations'),
    },
  })

  try {
    await db.migrate.rollback().then(() => {
      console.log('Migrations rolled back')
    })
  } catch (error) {
    console.error('Error rolling back migrations:', error)
  }

  await db.destroy()
}
