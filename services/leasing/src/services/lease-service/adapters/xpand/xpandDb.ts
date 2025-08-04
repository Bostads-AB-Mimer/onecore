import knex from 'knex'

import Config from '../../../../common/config'

export const createXpandDbClient = () =>
  knex({
    client: 'mssql',
    connection: Config.xpandDatabase,
  })

export const xpandDb = createXpandDbClient()
