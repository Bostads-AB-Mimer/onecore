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
      host: process.env.DATABASE__HOST,
      database: process.env.DATABASE__DATABASE,
      user: process.env.DATABASE__USER,
      password: process.env.DATABASE__PASSWORD,
      port: parseInt(process.env.DATABASE__PORT),
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
      host: process.env.DATABASE__HOST,
      database: process.env.DATABASE__DATABASE,
      user: process.env.DATABASE__USER,
      password: process.env.DATABASE__PASSWORD,
      port: parseInt(process.env.DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: 'mssql',
    connection: {
      host: process.env.DATABASE__HOST,
      database: process.env.DATABASE__DATABASE,
      user: process.env.DATABASE__USER,
      password: process.env.DATABASE__PASSWORD,
      port: parseInt(process.env.DATABASE__PORT),
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
}
