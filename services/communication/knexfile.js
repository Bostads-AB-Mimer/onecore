require('dotenv').config()

const baseConfig = {
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
}

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    ...baseConfig,
    seeds: {
      directory: './seeds/dev',
    },
  },
  test: {
    ...baseConfig,
    connection: {
      ...baseConfig.connection,
      database: 'communication-test',
    },
  },
  production: baseConfig,
}
