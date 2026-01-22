import sql, { ConnectionPool } from 'mssql'
import config from '../src/common/config'
import { Knex } from 'knex'

export const connect = (): Promise<ConnectionPool> => {
  const { user, password, host, port, database } = config.xpandDatabase
  return sql.connect({
    server: host,
    port: Number(port),
    user,
    password,
    database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  })
}
