import knex from 'knex'

import Config from './config'

/**
 * Knex client for the communication database. Shared by every db-backed
 * module in this service. Adapters that need to be testable inside a
 * rolled-back transaction take a `Knex` argument instead of importing this
 * instance directly.
 */
export const createDbClient = () =>
  knex({
    client: 'mssql',
    connection: Config.communicationDatabase,
    pool: {
      min: 0,
      max: 20,
      idleTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
    },
  })

export const db = createDbClient()
