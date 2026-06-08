// Update with your config settings.

require('dotenv').config()

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */

module.exports = {
  client: 'mssql',
  dev: {
    client: 'mssql',
    connection: {
      host: process.env.COMMUNICATION_DATABASE__HOST,
      database: process.env.COMMUNICATION_DATABASE__DATABASE,
      user: process.env.COMMUNICATION_DATABASE__USER,
      password: process.env.COMMUNICATION_DATABASE__PASSWORD,
      port: parseInt(process.env.COMMUNICATION_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds/dev',
    },
  },
  test: {
    client: 'mssql',
    connection: {
      host: process.env.COMMUNICATION_DATABASE__HOST,
      database: 'communication-test',
      user: process.env.COMMUNICATION_DATABASE__USER,
      password: process.env.COMMUNICATION_DATABASE__PASSWORD,
      port: parseInt(process.env.COMMUNICATION_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
  ci: {
    client: 'mssql',
    connection: {
      host: process.env.COMMUNICATION_DATABASE__HOST,
      database: process.env.COMMUNICATION_DATABASE__DATABASE,
      user: process.env.COMMUNICATION_DATABASE__USER,
      password: process.env.COMMUNICATION_DATABASE__PASSWORD,
      port: parseInt(process.env.COMMUNICATION_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: 'mssql',
    connection: {
      host: process.env.COMMUNICATION_DATABASE__HOST,
      database: process.env.COMMUNICATION_DATABASE__DATABASE,
      user: process.env.COMMUNICATION_DATABASE__USER,
      password: process.env.COMMUNICATION_DATABASE__PASSWORD,
      port: parseInt(process.env.COMMUNICATION_DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
}
