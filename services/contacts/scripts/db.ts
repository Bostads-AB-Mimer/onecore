import sql, { ConnectionPool } from 'mssql'
import config from '../src/common/config'

export const connect = async (): Promise<ConnectionPool> => {
  const { user, password, host, port, database } = config.xpandDatabase
  const pool: ConnectionPool = await sql.connect({
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
  console.log(`Connected to ${host}:${port}`)
  return pool
}
