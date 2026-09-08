import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsDbClient } from '@src/adapters/db'
import {
  IMPORT_ACTOR,
  runImport,
} from '@src/scripts/import-contact-relations/import'
import { DbContactRelationRow } from '@src/adapters/contact-relations'
import * as relationsRepository from '@src/adapters/contact-relations/repository'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

if (config.contactsDatabase.database !== 'contacts-test') {
  throw new Error(
    `Refusing to run against database "${config.contactsDatabase.database}". Must be "contacts-test".`
  )
}

// This suite mutates Xpand rows (cmctc, hyavk) to simulate changes between
// import runs, so guard the Xpand side explicitly too — not only via the
// e2e fixture's connect() check.
if (config.xpandDatabase.database !== 'contacts-xpand-test') {
  throw new Error(
    `Refusing to run against database "${config.xpandDatabase.database}". Must be "contacts-xpand-test".`
  )
}

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
  // Self-edge (P900007) and GDPR-placeholder fixtures: kept in the data set
  // so the run proves the query guards keep them out of contact_relation.
  'P900007',
  'RENSAD_GDPR',
]

const EXPECTED_FIRST_RUN = [
  ['P000555', 'P000444', 'forvaltare'],
  ['P000666', 'P000444', 'god_man'],
  ['P000777', 'P000888', 'forvaltare'],
  ['P000999', 'P000777', 'forvaltare'],
  ['P900001', 'P900010', 'annan_fakturamottagare'],
  ['P900004', 'P000888', 'annan_fakturamottagare'],
  ['P900005', 'P900013', 'annan_fakturamottagare'],
].sort()

const xpandResource = xpandDbClient(config.xpandDatabase)
const contactsResource = contactsDbClient(config.contactsDatabase)
let xpand: Knex
let contacts: Knex

const activeTriples = async () => {
  const rows: DbContactRelationRow[] =
    await contacts('contact_relation').whereNull('deleted_at')
  return rows
    .map((r) => [r.subject_contact_code, r.related_contact_code, r.role_type])
    .sort()
}

beforeAll(async () => {
  await Promise.all([xpandResource.init(), contactsResource.init()])
  xpand = xpandResource.get()
  contacts = contactsResource.get()
})

beforeEach(async () => {
  const pool = await connect()
  await prepareDataSet(pool, RELATION_DATA_SET)
  await pool.close()
  await contacts('contact_relation').del()
})

// These tests write real rows (no rollback transaction), so leave the shared
// contacts-test table empty for the suites that run after this one.
afterEach(async () => {
  await contacts('contact_relation').del()
})

afterAll(async () => {
  await Promise.all([xpandResource.close(), contactsResource.close()])
})

describe('runImport', () => {
  it('first run inserts every collapsible relation and reports the conflict', async () => {
    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(await activeTriples()).toEqual(EXPECTED_FIRST_RUN)
    expect(report).toMatchObject({
      dryRun: false,
      desired: { god_man: 1, forvaltare: 3, annan_fakturamottagare: 3 },
      inserted: 7,
      softDeleted: 0,
      unchanged: 0,
      protected: 0,
    })
    expect(report.conflicts).toEqual([
      {
        holderContactCode: 'P900006',
        recipients: [
          { contactCode: 'P900014', leaseIds: ['100-001-01-0007/01'] },
          { contactCode: 'P900015', leaseIds: ['100-001-01-0008/01'] },
        ],
      },
    ])

    const rows: DbContactRelationRow[] = await contacts('contact_relation')
    expect(rows.every((r) => r.created_by === IMPORT_ACTOR)).toBe(true)
  })

  it('second run is a no-op', async () => {
    await runImport({ xpandDb: xpand, contactsDb: contacts })
    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(report).toMatchObject({
      inserted: 0,
      softDeleted: 0,
      unchanged: 7,
      protected: 0,
    })
    expect(await activeTriples()).toEqual(EXPECTED_FIRST_RUN)
  })

  it('soft-deletes an import-owned row when the relation disappears from xpand', async () => {
    await runImport({ xpandDb: xpand, contactsDb: contacts })

    await xpand('cmctc')
      .where({ cmctckod: 'P000666' })
      .update({ keycmctc2: null, forvtyp: null })

    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(report).toMatchObject({
      inserted: 0,
      softDeleted: 1,
      unchanged: 6,
      protected: 0,
    })
    expect(await activeTriples()).toEqual(
      EXPECTED_FIRST_RUN.filter(([subject]) => subject !== 'P000666')
    )
    const [deleted]: DbContactRelationRow[] = await contacts(
      'contact_relation'
    ).where({
      subject_contact_code: 'P000666',
    })
    expect(deleted.deleted_at).toEqual(expect.any(Date))
    expect(deleted.deleted_by).toBe(IMPORT_ACTOR)
  })

  it('leaves rows created by other actors untouched', async () => {
    await contacts('contact_relation').insert({
      subject_contact_code: 'P000111',
      related_contact_code: 'P000222',
      role_type: 'god_man',
      created_by: 'manual-admin',
    })

    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(report).toMatchObject({ inserted: 7, softDeleted: 0 })
    const [manual]: DbContactRelationRow[] = await contacts(
      'contact_relation'
    ).where({
      created_by: 'manual-admin',
    })
    expect(manual.deleted_at).toBeNull()
  })

  it('dry run reports the plan but writes nothing', async () => {
    const report = await runImport({
      xpandDb: xpand,
      contactsDb: contacts,
      dryRun: true,
    })

    expect(report).toMatchObject({ dryRun: true, inserted: 7 })
    expect(await contacts('contact_relation')).toEqual([])
  })

  it('keeps a previously imported recipient when the holder becomes a conflict', async () => {
    // First run: P900001 has a single recipient P900010 (leases OBJ1 + OBJ5).
    await runImport({ xpandDb: xpand, contactsDb: contacts })

    // Xpand changes: OBJ5's recipient becomes P900013 → P900001 now conflicts.
    await xpand('hyavk')
      .where({ keyhyavk: '_AVKFM00005    ' })
      .update({
        keycmctc: xpand('cmctc')
          .select('keycmctc')
          .where({ cmctckod: 'P900013' }),
      })

    const report = await runImport({ xpandDb: xpand, contactsDb: contacts })

    expect(report).toMatchObject({ inserted: 0, softDeleted: 0, protected: 1 })
    expect(report.conflicts.map((c) => c.holderContactCode)).toEqual([
      'P900001',
      'P900006',
    ])
    expect(await activeTriples()).toEqual(EXPECTED_FIRST_RUN)
  })

  it('writes nothing when a write fails inside the transaction', async () => {
    // Seed one import-owned row that the run will want to delete, so both
    // an insert and a delete are planned.
    await contacts('contact_relation').insert({
      subject_contact_code: 'P000111',
      related_contact_code: 'P000222',
      role_type: 'god_man',
      created_by: IMPORT_ACTOR,
    })
    const spy = jest
      .spyOn(relationsRepository, 'softDeleteByIds')
      .mockRejectedValue(new Error('boom'))
    try {
      await expect(
        runImport({ xpandDb: xpand, contactsDb: contacts })
      ).rejects.toThrow('boom')
    } finally {
      spy.mockRestore()
    }
    expect(await activeTriples()).toEqual([['P000111', 'P000222', 'god_man']])
  })
})
