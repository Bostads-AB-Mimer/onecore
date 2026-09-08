import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import {
  allGuardianEdges,
  allInvoiceRecipientCandidates,
} from '@src/adapters/xpand/relation-import-query'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

const RELATION_DATA_SET = [
  ...FULL_TEST_DATA_SET,
  'P900001',
  'P900002',
  'P900003',
  'P900004',
  'P900005',
  'P900006',
  'P900010',
  'P900011',
  'P900012',
  'P900013',
  'P900014',
  'P900015',
]

const xpandResource = xpandDbClient(config.xpandDatabase)
let xpand: Knex

beforeAll(async () => {
  const pool = await connect()
  await prepareDataSet(pool, RELATION_DATA_SET)
  await pool.close()
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await xpandResource.close()
})

describe('allGuardianEdges', () => {
  it('returns every god man / förvaltare edge with the role from forvtyp', async () => {
    const edges = await allGuardianEdges(xpand)

    expect(edges).toEqual(
      expect.arrayContaining([
        {
          subjectContactCode: 'P000555',
          relatedContactCode: 'P000444',
          roleType: 'forvaltare',
        },
        {
          subjectContactCode: 'P000666',
          relatedContactCode: 'P000444',
          roleType: 'god_man',
        },
        {
          subjectContactCode: 'P000777',
          relatedContactCode: 'P000888',
          roleType: 'forvaltare',
        },
        {
          subjectContactCode: 'P000999',
          relatedContactCode: 'P000777',
          roleType: 'forvaltare',
        },
      ])
    )
    expect(edges).toHaveLength(4)
  })
})

describe('allInvoiceRecipientCandidates', () => {
  it('returns one row per current ANNANFM on an active lease, with the lease id', async () => {
    const rows = await allInvoiceRecipientCandidates(xpand, new Date())

    expect(rows).toEqual(
      expect.arrayContaining([
        {
          holderContactCode: 'P900001',
          recipientContactCode: 'P900010',
          leaseId: '100-001-01-0001/01',
        },
        {
          holderContactCode: 'P900001',
          recipientContactCode: 'P900010',
          leaseId: '100-001-01-0005/01',
        },
        {
          holderContactCode: 'P900004',
          recipientContactCode: 'P000888',
          leaseId: '100-001-01-0004/01',
        },
        {
          holderContactCode: 'P900005',
          recipientContactCode: 'P900013',
          leaseId: '100-001-01-0006/01',
        },
        {
          holderContactCode: 'P900006',
          recipientContactCode: 'P900014',
          leaseId: '100-001-01-0007/01',
        },
        {
          holderContactCode: 'P900006',
          recipientContactCode: 'P900015',
          leaseId: '100-001-01-0008/01',
        },
      ])
    )
    // Terminated lease (OBJ2) and expired ANNANFM rows (OBJ3) are excluded.
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.holderContactCode)).not.toContain('P900002')
    expect(rows.map((r) => r.holderContactCode)).not.toContain('P900003')
  })
})
