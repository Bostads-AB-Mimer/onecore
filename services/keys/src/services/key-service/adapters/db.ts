import knex from 'knex'
import Config from '../../../common/config'

export const db = knex({
  client: 'mssql',
  connection: Config.keysDatabase,
  pool: { min: 0, max: 20, idleTimeoutMillis: 30000, destroyTimeoutMillis: 5000 },
})
