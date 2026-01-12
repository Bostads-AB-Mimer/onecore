import knex from 'knex'

import { makeResource } from '@src/common/resource'
import config from '@src/common/config'

export const xpandDbClient = () => {
  return makeResource<knex.Knex>({
    name: 'xpand-db',
    initialize: async () => {
      return knex({
        client: 'mssql',
        connection: {
          host: config.xpandDatabase.host,
          user: config.xpandDatabase.user,
          password: config.xpandDatabase.password,
          port: Number(config.xpandDatabase.port),
          database: config.xpandDatabase.database,
        },
        pool: {
          min: 0,
          max: 20,
          idleTimeoutMillis: 30000,
          destroyTimeoutMillis: 5000,
        },
      })
    },
    healthcheck: async (knex: knex.Knex) => {
      return true
    },
    teardown: async () => {},
  })
}
