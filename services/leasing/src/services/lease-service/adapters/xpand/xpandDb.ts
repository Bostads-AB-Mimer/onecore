import knex from 'knex'

import Config from '../../../../common/config'

export const createXpandDbClient = () =>
  knex({
    client: 'mssql',
    connection: Config.xpandDatabase,
    pool: {
      min: 0,
      max: 20,
      idleTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
    },
  })

export const xpandDb = createXpandDbClient()
