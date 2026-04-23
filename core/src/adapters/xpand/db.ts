import knex from 'knex'
import { type KnexConnectionParameters } from '@onecore/utilities'

export const createXpandDbClient = (config: KnexConnectionParameters) =>
  knex({
    client: 'mssql',
    connection: {
      host: config.host,
      user: config.user,
      password: config.password,
      port: Number(config.port),
      database: config.database,
    },
    pool: {
      min: 0,
      max: 5,
      idleTimeoutMillis: 30000,
    },
  })
