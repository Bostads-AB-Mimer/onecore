import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsDbClient } from '@src/adapters/db'
import {
  insertMany,
  listActive,
  relatedContactsFor,
  relatedContactsForMany,
  softDeleteByIds,
} from '@src/adapters/contact-relations'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'
import { requireContactsTestDb } from '../../db-support'

requireContactsTestDb()

const xpandResource = xpandDbClient(config.xpandDatabase)
const contactsResource = contactsDbClient(config.contactsDatabase)
let xpand: Knex
let contacts: Knex

beforeAll(async () => {
  const pool = await connect()
  // RENSAD_GDPR is kept so the read-path guard is exercised against a
  // contact that does exist (and has a name) in Xpand.
  await prepareDataSet(pool, [...FULL_TEST_DATA_SET, 'RENSAD_GDPR'])
  await pool.close()
  await Promise.all([xpandResource.init(), contactsResource.init()])
  xpand = xpandResource.get()
  contacts = contactsResource.get()
})

beforeEach(async () => {
  await contacts('contact_relation').del()
  await insertMany(
    contacts,
    [
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
        subjectContactCode: 'P000111',
        relatedContactCode: 'P000222',
        roleType: 'annan_fakturamottagare',
      },
      {
        subjectContactCode: 'P000333',
        relatedContactCode: 'P999999',
        roleType: 'god_man',
      },
    ],
    'test'
  )
})

afterAll(async () => {
  await contacts('contact_relation').del()
  await Promise.all([xpandResource.close(), contactsResource.close()])
})

describe('relatedContactsForMany', () => {
  it('maps subject-side rows to forward roles with hydrated names', async () => {
    const byCode = await relatedContactsForMany(xpand, contacts, [
      'P000555',
      'P000111',
    ])

    expect(byCode.get('P000555')).toEqual([
      {
        contactCode: 'P000444',
        role: 'administrator',
        fullName: 'McTestface Testy',
        firstName: 'Testy',
        lastName: 'McTestface',
      },
    ])
    expect(byCode.get('P000111')).toEqual([
      expect.objectContaining({
        contactCode: 'P000222',
        role: 'otherInvoiceRecipient',
      }),
    ])
  })

  it('maps related-side rows to reverse roles', async () => {
    const byCode = await relatedContactsForMany(xpand, contacts, [
      'P000444',
      'P000222',
    ])

    expect(byCode.get('P000444')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactCode: 'P000555',
          role: 'administratorFor',
        }),
        expect.objectContaining({
          contactCode: 'P000666',
          role: 'trusteeFor',
        }),
      ])
    )
    expect(byCode.get('P000444')).toHaveLength(2)
    expect(byCode.get('P000222')).toEqual([
      expect.objectContaining({
        contactCode: 'P000111',
        role: 'otherInvoiceRecipientFor',
      }),
    ])
  })

  it('redacts names of protected identities', async () => {
    const byCode = await relatedContactsForMany(xpand, contacts, ['P000777'])
    expect(byCode.get('P000777')).toEqual([
      {
        contactCode: 'P000888',
        role: 'administrator',
        fullName: 'redacted',
        firstName: 'redacted',
        lastName: 'redacted',
      },
    ])
  })

  it('drops edges whose other side no longer exists in xpand', async () => {
    const byCode = await relatedContactsForMany(xpand, contacts, ['P000333'])
    expect(byCode.get('P000333')).toBeUndefined()
  })

  it('ignores soft-deleted rows', async () => {
    const [row] = (await listActive(contacts)).filter(
      (r) => r.subject_contact_code === 'P000555'
    )
    await softDeleteByIds(contacts, [row.id], 'test')

    const byCode = await relatedContactsForMany(xpand, contacts, ['P000555'])
    expect(byCode.get('P000555')).toBeUndefined()
  })

  it('trims requested codes and keys the result by the trimmed code', async () => {
    const byCode = await relatedContactsForMany(xpand, contacts, ['P000555 '])
    expect(byCode.get('P000555')).toHaveLength(1)
  })

  it('returns an empty map for no codes', async () => {
    expect((await relatedContactsForMany(xpand, contacts, [])).size).toBe(0)
  })
})

describe('relatedContactsForMany GDPR guard', () => {
  it('never returns the GDPR-erased placeholder as a related contact', async () => {
    await insertMany(
      contacts,
      [
        {
          subjectContactCode: 'P001000',
          relatedContactCode: 'RENSAD_GDPR',
          roleType: 'god_man',
        },
        {
          subjectContactCode: 'RENSAD_GDPR',
          relatedContactCode: 'P001000',
          roleType: 'annan_fakturamottagare',
        },
      ],
      'test'
    )

    const byCode = await relatedContactsForMany(xpand, contacts, [
      'P001000',
      'RENSAD_GDPR',
    ])

    expect(byCode.size).toBe(0)
  })
})

describe('relatedContactsFor', () => {
  it('returns the list for one contact, or [] when there are none', async () => {
    expect(await relatedContactsFor(xpand, contacts, 'P000666')).toEqual([
      expect.objectContaining({ contactCode: 'P000444', role: 'trustee' }),
    ])
    expect(await relatedContactsFor(xpand, contacts, 'P001000')).toEqual([])
  })

  it('merges forward and reverse roles when a code is subject in one row and related in another', async () => {
    await insertMany(
      contacts,
      [
        {
          subjectContactCode: 'P000444',
          relatedContactCode: 'P000222',
          roleType: 'annan_fakturamottagare',
        },
      ],
      'test'
    )

    const list = await relatedContactsFor(xpand, contacts, 'P000444')

    expect(list.map((r) => [r.contactCode, r.role]).sort()).toEqual([
      ['P000222', 'otherInvoiceRecipient'],
      ['P000555', 'administratorFor'],
      ['P000666', 'trusteeFor'],
    ])
  })

  it('returns one entry when the same edge is stored as two active rows', async () => {
    await insertMany(
      contacts,
      [
        {
          subjectContactCode: 'P000555',
          relatedContactCode: 'P000444',
          roleType: 'forvaltare',
        },
      ],
      'test'
    )

    const list = await relatedContactsFor(xpand, contacts, 'P000555')

    expect(list).toHaveLength(1)
  })

  it('tolerates stored codes with trailing whitespace', async () => {
    await contacts('contact_relation').insert({
      subject_contact_code: 'P001000 ',
      related_contact_code: 'P000444 ',
      role_type: 'god_man',
      created_by: 'test',
    })

    const list = await relatedContactsFor(xpand, contacts, 'P001000')

    expect(list).toEqual([
      expect.objectContaining({ contactCode: 'P000444', role: 'trustee' }),
    ])
  })
})
