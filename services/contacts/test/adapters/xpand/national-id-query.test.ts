import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsQuery } from '@src/adapters/xpand/query'
import { parseNationalId } from '@src/domain/national-id'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

const xpandResource = xpandDbClient(config.xpandDatabase)
let xpand: Knex

beforeAll(async () => {
  const pool = await connect()
  await prepareDataSet(pool, FULL_TEST_DATA_SET)
  await pool.close()
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await xpandResource.close()
})

describe('hasNationalId', () => {
  it('matches a contact stored in one digit form by searching with both candidate forms', async () => {
    const candidates = await xpand('cmctc')
      .select('cmctckod', 'persorgnr')
      .whereIn('cmctckod', FULL_TEST_DATA_SET)

    const seeded = candidates
      .map((row) => ({
        contactCode: row.cmctckod as string,
        forms: parseNationalId((row.persorgnr as string) ?? ''),
      }))
      .find((row) => row.forms !== null)

    if (!seeded || !seeded.forms) {
      throw new Error(
        'No seeded contact with a valid personnummer found — cannot verify ten/twelve-digit matching'
      )
    }

    // parseNationalId always returns both forms regardless of which one the
    // user typed, so the real caller (getByNationalIdNumber) always searches
    // with both — this is what actually needs to match the stored row,
    // whichever of the two forms it happens to use.
    const result = await contactsQuery()
      .hasNationalId([seeded.forms.twelveDigits, seeded.forms.tenDigits])
      .getOne(xpand)

    expect(result[0]?.contactCode).toBe(seeded.contactCode)
  })

  it('finds nothing for a personnummer that matches no seeded contact', async () => {
    const result = await contactsQuery()
      .hasNationalId(['9999999999', '199999999999'])
      .getOne(xpand)

    expect(result).toEqual([])
  })
})
