import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsDbClient } from '@src/adapters/db'
import { runImport } from '@src/scripts/import-contact-relations/import'
import { DbContactRelationRow } from '@src/adapters/contact-relations'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'
import { requireContactsTestDb, requireXpandTestDb } from '../../db-support'

requireContactsTestDb()
requireXpandTestDb()

// P900001 has ANNANFM P900010 on OBJ1 + OBJ5 and the same contact as c/o on
// OBJ1; P900020 has only a c/o (P900021); P900023's lease has c/o P900021 and
// a different ANNANFM, P900024.
const CO_ADDRESSEE_DATA_SET = [
  ...FULL_TEST_DATA_SET,
  'P900001',
  'P900010',
  'P900020',
  'P900021',
  'P900022',
  'P900023',
  'P900024',
]

const xpandResource = xpandDbClient(config.xpandDatabase)
const contactsResource = contactsDbClient(config.contactsDatabase)
let xpand: Knex
let contacts: Knex

const activeRecipientPairs = async () => {
  const rows: DbContactRelationRow[] = await contacts('contact_relation')
    .whereNull('deleted_at')
    .where({ role_type: 'annan_fakturamottagare' })
  return rows
    .map((r) => [r.subject_contact_code, r.related_contact_code])
    .sort()
}

beforeAll(async () => {
  await Promise.all([xpandResource.init(), contactsResource.init()])
  xpand = xpandResource.get()
  contacts = contactsResource.get()
  const pool = await connect()
  await prepareDataSet(pool, CO_ADDRESSEE_DATA_SET)
  await pool.close()
})

afterEach(async () => {
  await contacts('contact_relation').del()
})

afterAll(async () => {
  await Promise.all([xpandResource.close(), contactsResource.close()])
})

describe('runImport with c/o addressees', () => {
  it('imports a c/o addressee as annan fakturamottagare', async () => {
    await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(await activeRecipientPairs()).toContainEqual(['P900020', 'P900021'])
  })

  it('writes one edge when the c/o and the ANNANFM recipient are the same contact', async () => {
    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(await activeRecipientPairs()).toEqual([
      ['P900001', 'P900010'],
      ['P900020', 'P900021'],
    ])
    expect(report.desired.annan_fakturamottagare).toBe(2)
  })

  it('reports a holder whose c/o differs from the ANNANFM recipient as a conflict', async () => {
    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(report.conflicts).toEqual([
      {
        holderContactCode: 'P900023',
        recipients: [
          { contactCode: 'P900021', leaseIds: ['100-001-01-0012/01'] },
          { contactCode: 'P900024', leaseIds: ['100-001-01-0012/01'] },
        ],
      },
    ])
    expect(
      (await activeRecipientPairs()).map(([subject]) => subject)
    ).not.toContain('P900023')
  })
})
