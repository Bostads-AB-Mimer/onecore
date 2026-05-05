'use strict'

require('dotenv').config()

const knex = require('knex')
const knexfile = require('../knexfile')

const { connection } = knexfile.dev

if (!connection.database) {
  console.error(
    'ensure-db: database name is not set — check your env vars (ECONOMY_DATABASE__DATABASE)'
  )
  process.exit(1)
}

const db = knex({
  client: 'mssql',
  connection: { ...connection, database: 'master' },
})

async function main() {
  console.log(`Ensuring database '${connection.database}' exists...`)
  await db.raw(
    `IF DB_ID(N'${connection.database}') IS NULL CREATE DATABASE [${connection.database}]`
  )
  console.log(`Database '${connection.database}' is ready.`)
}

main()
  .catch(err => {
    // Error 1801: database already exists — another instance beat us to it, which is fine
    if (err.number === 1801) {
      console.log(`Database '${connection.database}' already exists.`)
      return
    }
    console.error('ensure-db failed:', err.message)
    process.exit(1)
  })
  .finally(() => db.destroy())
