import knex from 'knex'
import Config from '../../../common/config'
import * as path from 'path'

const getStandardConfig = () => ({
  client: 'mssql',
  connection: Config.leasingDatabase,
})

const getTestConfig = () => {
  return {
    client: 'mssql',
    connection: Config.leasingDatabase,
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      directory: path.join(__dirname, '../../../../migrations'),
    },
  }
}

const getConfigBasedOnEnvironment = () => {
  const environment = process.env.NODE_ENV || 'dev'
  return environment === 'test' ? getTestConfig() : getStandardConfig()
}

export const db = knex(getConfigBasedOnEnvironment())

const migrate = async () => {
  await db.migrate
    .latest()
    .then(() => {
      console.log('Migrations applied')
    })
    .catch((error) => {
      console.error('Error applying migrations', error)
    })
}

const teardown = async () => {
  console.log('Rolling back migrations')
  try {
    await db.migrate.rollback().then(() => {
      console.log('Migrations rolled back')
    })
  } catch (error) {
    console.error('Error rolling back migrations:', error)
  }

  await db.destroy().then(() => {
    console.log('Database destroyed')
  })
}

export { migrate, teardown }
