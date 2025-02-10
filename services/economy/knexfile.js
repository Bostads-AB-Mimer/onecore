// Update with your config settings.
require('dotenv').config()

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */

//todo: update knex file to support multiple connections
//todo: fix docker file, read from 2 different knex files?
module.exports = {
  client: 'mssql',
  dev: {
    client: 'mssql',
    connection: {
      host: process.env.ECONOMY_DATABASE__HOST,
      database: process.env.ECONOMY_DATABASE__DATABASE,
      user: process.env.ECONOMY_DATABASE__USER,
      password: process.env.ECONOMY_DATABASE__PASSWORD,
      port: parseInt(process.env.ECONOMY_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds/dev',
    },
  },
  ci: {
    client: 'mssql',
    connection: {
      host: process.env.ECONOMY_DATABASE__HOST,
      database: process.env.ECONOMY_DATABASE__DATABASE,
      user: process.env.ECONOMY_DATABASE__USER,
      password: process.env.ECONOMY_DATABASE__PASSWORD,
      port: parseInt(process.env.ECONOMY_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: 'mssql',
    connection: {
      host: process.env.ECONOMY_DATABASE__HOST,
      database: process.env.ECONOMY_DATABASE__DATABASE,
      user: process.env.ECONOMY_DATABASE__USER,
      password: process.env.ECONOMY_DATABASE__PASSWORD,
      port: parseInt(process.env.ECONOMY_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
}
