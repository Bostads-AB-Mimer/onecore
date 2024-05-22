import knex from 'knex'
import Config from '../../../common/config'

export const db = knex({
  client: 'mssql',
  connection: Config.leasingDatabase,
})
