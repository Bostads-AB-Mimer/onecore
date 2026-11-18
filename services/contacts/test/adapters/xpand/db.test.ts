import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { connect } from '../../e2e/app-fixture'

const xpandResource = xpandDbClient(config.xpandDatabase)
let xpand: Knex

beforeAll(async () => {
  // connect() refuses anything but the local test database.
  const pool = await connect()
  await pool.close()
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await xpandResource.close()
})

describe('xpandDbClient', () => {
  /**
   * Knex puts a failed query's SQL into err.message, which is logged and
   * returned in 500 bodies. For mssql it rewrites `?` to `@p0` before that, so
   * bound values (a personnummer, for the by-nid lookups) are not filled in.
   * This pins that, so a knex upgrade that changes it is noticed.
   */
  it('keeps bound values out of the message of a failed query', async () => {
    // Checksum-valid but only used here; the query fails before matching.
    const personnummer = '199007292387'

    const err: unknown = await xpand('no_such_table')
      .where('persorgnr', personnummer)
      .select('*')
      .then(
        () => undefined,
        (e: unknown) => e
      )

    if (!(err instanceof Error)) throw new Error('Expected the query to fail')
    expect(err.message).toContain('[persorgnr] = @p0')
    expect(err.message).not.toContain(personnummer)
  })
})
