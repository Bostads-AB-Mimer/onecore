import path from 'node:path'
import fs from 'node:fs/promises'
import makeApp from '@src/app'
import config from '@src/common/config'
import { makeAppContext } from '@src/context'
import axios from 'axios'
import sql, { ConnectionPool } from 'mssql'
import { Server, Agent } from 'node:http'

/**
 * Throws exception indicating that we are attempting to perform writes to a database that
 * should not be written to.
 */
const refuseSetup = (dbName: string) => {
  throw new Error(
    [
      `Refusing to modify and run against database "${dbName}".`,
      'Must be "contacts-xpand-test".',
      "It's entirely likely that you were just prevented from wiping the remote Xpand test database.",
      'Rejoice and be happy!',
    ].join('\n')
  )
}

/**
 * Create a raw mssql Connection Pool for setting up test data.
 *
 * @return {Promise<ConnectionPool>} The connection pool.
 *
 * @throws Will throw an error if attempting to connect to a non-test database.
 */
export const connect = async (): Promise<ConnectionPool> => {
  const { user, password, host, port, database } = config.xpandDatabase
  if (database !== 'contacts-xpand-test') {
    refuseSetup(database)
  }
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
  return pool
}

export type FixtureOptions = {
  /**
   * The data set to apply to the test database.
   */
  dataSet: string[]
}

/**
 * Creates a test application fixture with methods to start and stop the server,
 * as well as applying the requested data set to the test database.
 *
 * @param opts - Options for creating the test app fixture.
 *
 * @return A promise resolving to the test app fixture with start, stop, port,
 *         and makeClient methods.
 */
export const makeTestAppFixture = async (opts: FixtureOptions) => {
  const ctx = makeAppContext(config)
  const app = makeApp(ctx)
  let server: Server | undefined = undefined

  const pool = await connect()

  await prepareDataSet(pool, opts.dataSet)

  await pool.close()

  return {
    async start(): Promise<void> {
      return new Promise((resolve) => {
        server = app.listen(0, () => {
          resolve()
        })
      })
    },
    async stop(): Promise<void> {
      if (server) {
        return new Promise((resolve) => {
          server!.close(() => {
            server = undefined
            resolve()
          })
        })
      }
    },
    port() {
      if (server) {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          return addr.port
        }
      }
    },
    makeClient() {
      const httpAgent = new Agent({ keepAlive: false })
      return axios.create({
        httpAgent: httpAgent,
        baseURL: `http://localhost:${this.port()}`,
      })
    },
  }
}

export type TestApp = Awaited<ReturnType<typeof makeTestAppFixture>>

/**
 * Ensures that the provided connection pool is connected to the test database.
 *
 * This should never have happened since the pool factory-method has the same
 * guard, but let's just... not write to a production or shared test DB.
 *
 * @param pool - The connection pool to check.
 */
export const ensureTestDatabase = async (pool: ConnectionPool) => {
  const result = await pool.request().query(`
    SELECT DB_NAME() AS dbName
  `)

  const { dbName } = result.recordset[0]

  if (dbName !== 'contacts-xpand-test') {
    refuseSetup(dbName)
  }
}

/**
 * Applies the seed.sql containing test curated test data.
 */
export const applySeedDotSql = async (pool: ConnectionPool) => {
  const seedPath = path.resolve(__dirname, '../../.jest/sql/seed.sql')
  const seedSql = await fs.readFile(seedPath, 'utf8')
  await pool.batch(seedSql)
}

/**
 * Clears all data from the relevant tables.
 */
export const clearTables = async (pool: ConnectionPool) => {
  await pool.request().batch(`
    DELETE FROM cmtel;
    DELETE FROM cmeml;
    DELETE FROM cmadr;
    DELETE FROM cmctc;
  `)
}

/**
 * Trims the data in the database to only include the provided data set.
 *
 * A more stream-lined version would have been to never insert unwanted
 * rows to begin with, but ain't nobody got no time to back-track on this
 * now.
 */
export const trimToDataSet = async (
  pool: ConnectionPool,
  dataSet: string[]
) => {
  const keycmobjs = (
    await pool.query(
      `SELECT keycmobj FROM cmctc WHERE cmctckod IN (${dataSet.map((cc) => `'${cc}'`).join(', ')})`
    )
  ).recordset.map((r) => r.keycmobj)

  const keycmobjList = keycmobjs.map((cmobj) => `'${cmobj}'`).join(', ')

  await pool.request().batch(`
    DELETE FROM cmtel WHERE keycmobj NOT IN (${keycmobjList});
    DELETE FROM cmeml WHERE keycmobj NOT IN (${keycmobjList});
    DELETE FROM cmadr WHERE keycode NOT IN (${keycmobjList});
    DELETE FROM cmctc WHERE keycmobj NOT IN (${keycmobjList});
  `)
}

/**
 * Prepares the test database with the provided data set.
 *
 * 1. Make sure the database we are connected to is in fact the local test db.
 * 2. Clear all current rows from the test tables
 * 3. Apply all test data from seed.sql
 * 4. Trim inserted data to fit the requested `dataSet`.
 *
 * @param pool - The connection pool to the test database.
 */
export const prepareDataSet = async (
  pool: ConnectionPool,
  dataSet: string[]
) => {
  await ensureTestDatabase(pool)
  await clearTables(pool)
  await applySeedDotSql(pool)
  await trimToDataSet(pool, dataSet)
}
