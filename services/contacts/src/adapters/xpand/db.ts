import knex from 'knex'

import { makeResource } from '@src/common/resource'
import { DatabaseConfig } from '@src/common/config'

export const xpandDbClient = (config: DatabaseConfig) => {
  return makeResource<knex.Knex>({
    name: 'xpand-db',
    initialize: async () => {
      return knex({
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
