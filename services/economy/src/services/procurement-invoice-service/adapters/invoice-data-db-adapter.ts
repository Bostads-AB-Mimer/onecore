import knex from 'knex'
import config from '../../../common/config'

const db = knex({
  connection: {
    host: config.economyDatabase.host,
    user: config.economyDatabase.user,
    password: config.economyDatabase.password,
    port: config.economyDatabase.port,
    database: config.economyDatabase.database,
  },
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
}

export const getCounterPartCustomers = async () => {
  const result = await db('invoice_counterpart')

  return result
}
