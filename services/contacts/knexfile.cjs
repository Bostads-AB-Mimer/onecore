require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH })

const baseConfig = {
  client: 'mssql',
  connection: {
    host: process.env.CONTACTS_DATABASE__HOST,
    database: process.env.CONTACTS_DATABASE__DATABASE,
    user: process.env.CONTACTS_DATABASE__USER,
    password: process.env.CONTACTS_DATABASE__PASSWORD,
    port: parseInt(process.env.CONTACTS_DATABASE__PORT),
  },
  migrations: {
    tableName: 'knex_migrations',
  },
}

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: baseConfig,
  test: {
    ...baseConfig,
    connection: {
      ...baseConfig.connection,
      database: 'contacts-test',
    },
  },
  production: baseConfig,
}
