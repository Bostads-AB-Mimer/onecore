import knex from 'knex'
import Config from '../../../common/config'

export const createDbClient = () =>
  knex({
    client: 'mssql',
    connection: Config.inspectionDatabase,
    pool: {
      min: 0,
      max: 20,
      idleTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
    },
  })

export const db = createDbClient()
