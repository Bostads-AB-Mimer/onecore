import knex from 'knex'

import Config from '../../../common/config'

export const createDbClient = () =>
  knex({
    client: 'mssql',
    connection: Config.leasingDatabase,
  })

export const db = createDbClient()
