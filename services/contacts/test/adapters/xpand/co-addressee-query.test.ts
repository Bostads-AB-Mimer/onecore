import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { allCoAddresseeCandidates } from '@src/adapters/xpand/relation-import-query'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

const CO_ADDRESSEE_DATA_SET = [
  ...FULL_TEST_DATA_SET,
  'P900001',
  'P900002',
  'P900007',
  'P900010',
  'P900020',
  'P900021',
  'P900022',
  'P900023',
  'P900024',
]

const xpandResource = xpandDbClient(config.xpandDatabase)
let xpand: Knex

beforeAll(async () => {
  const pool = await connect()
  await prepareDataSet(pool, CO_ADDRESSEE_DATA_SET)
  await pool.close()
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await xpandResource.close()
})

describe('allCoAddresseeCandidates', () => {
  it('returns one row per c/o addressee on a current invoice period of an active lease', async () => {
    const rows = await allCoAddresseeCandidates(xpand, new Date())

    // Excluded: P900022 (expired period), P900002 (terminated lease),
    // P900007 (their own c/o).
    expect(
      [...rows].sort((a, b) => (a.leaseKey < b.leaseKey ? -1 : 1))
    ).toEqual([
      {
        holderContactCode: 'P900001',
        recipientContactCode: 'P900010',
        leaseKey: '_OBJ000001',
        leaseId: '100-001-01-0001/01',
      },
      {
        holderContactCode: 'P900020',
        recipientContactCode: 'P900021',
        leaseKey: '_OBJ000010',
        leaseId: '100-001-01-0010/01',
      },
      {
        holderContactCode: 'P900023',
        recipientContactCode: 'P900021',
        leaseKey: '_OBJ000012',
        leaseId: '100-001-01-0012/01',
      },
    ])
  })

  it('treats a NULL period start as unbounded and excludes periods not yet started', async () => {
    const rows = await allCoAddresseeCandidates(xpand, new Date('2019-01-01'))

    expect(rows).toEqual([
      {
        holderContactCode: 'P900023',
        recipientContactCode: 'P900021',
        leaseKey: '_OBJ000012',
        leaseId: '100-001-01-0012/01',
      },
    ])
  })
})
