import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsDbClient } from '@src/adapters/db'
import {
  insertMany,
  listActive,
  RelationEdge,
  softDeleteByIds,
} from '@src/adapters/contact-relations'
import {
  relatedContactsFor,
  relatedContactsForMany,
  relatedContactsInRole,
} from '@src/adapters/related-contacts'
import { connect, prepareDataSet } from '../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../e2e/data-set'
import { makeWithContext, requireContactsTestDb } from '../db-support'

requireContactsTestDb()

const xpandResource = xpandDbClient(config.xpandDatabase)
const contactsResource = contactsDbClient(config.contactsDatabase)
const withContext = makeWithContext(contactsResource)
let xpand: Knex

// P999999 is deliberately absent from the Xpand seed, so P000333's edge has
// no counterpart to hydrate.
const EDGES: RelationEdge[] = [
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
]

const seed = (db: Knex) => insertMany(db, EDGES, 'test')

beforeAll(async () => {
  const pool = await connect()
  await prepareDataSet(pool, FULL_TEST_DATA_SET)
  await pool.close()
  await Promise.all([xpandResource.init(), contactsResource.init()])
  xpand = xpandResource.get()
})

afterAll(async () => {
  await Promise.all([xpandResource.close(), contactsResource.close()])
})

describe('relatedContactsForMany', () => {
  it('maps subject-side rows to forward roles with hydrated names', () =>
    withContext(async ({ db }) => {
      await seed(db)

      const byCode = await relatedContactsForMany(xpand, db, [
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
    }))

  it('maps related-side rows to reverse roles', () =>
    withContext(async ({ db }) => {
      await seed(db)

      const byCode = await relatedContactsForMany(xpand, db, [
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
    }))

  it('redacts names of protected identities', () =>
    withContext(async ({ db }) => {
      await seed(db)

      const byCode = await relatedContactsForMany(xpand, db, ['P000777'])

      expect(byCode.get('P000777')).toEqual([
        {
          contactCode: 'P000888',
          role: 'administrator',
          fullName: 'redacted',
          firstName: 'redacted',
          lastName: 'redacted',
        },
      ])
    }))

  it('drops edges whose other side no longer exists in xpand', () =>
    withContext(async ({ db }) => {
      await seed(db)

      const byCode = await relatedContactsForMany(xpand, db, ['P000333'])

      expect(byCode.get('P000333')).toBeUndefined()
    }))

  it('trims requested codes and keys the result by the trimmed code', () =>
    withContext(async ({ db }) => {
      await seed(db)

      const byCode = await relatedContactsForMany(xpand, db, ['P000555 '])

      expect(byCode.get('P000555')).toHaveLength(1)
    }))

  it('returns an empty map for no codes', () =>
    withContext(async ({ db }) => {
      expect((await relatedContactsForMany(xpand, db, [])).size).toBe(0)
    }))
})

describe('relatedContactsFor', () => {
  it('returns the list for one contact, or [] when there are none', () =>
    withContext(async ({ db }) => {
      await seed(db)

      expect(await relatedContactsFor(xpand, db, 'P000666')).toEqual([
        expect.objectContaining({ contactCode: 'P000444', role: 'trustee' }),
      ])
      expect(await relatedContactsFor(xpand, db, 'P001000')).toEqual([])
    }))

  it('merges forward and reverse roles when a code is subject in one row and related in another', () =>
    withContext(async ({ db }) => {
      await seed(db)
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000444',
            relatedContactCode: 'P000222',
            roleType: 'annan_fakturamottagare',
          },
        ],
        'test'
      )

      const list = await relatedContactsFor(xpand, db, 'P000444')

      expect(list.map((r) => [r.contactCode, r.role]).sort()).toEqual([
        ['P000222', 'otherInvoiceRecipient'],
        ['P000555', 'administratorFor'],
        ['P000666', 'trusteeFor'],
      ])
    }))

  it('returns one entry per active edge', () =>
    withContext(async ({ db }) => {
      await seed(db)

      expect(await relatedContactsFor(xpand, db, 'P000555')).toHaveLength(1)
    }))

  it('tolerates stored codes with trailing whitespace', () =>
    withContext(async ({ db }) => {
      await db('contact_relation').insert({
        subject_contact_code: 'P001000 ',
        related_contact_code: 'P000444 ',
        role_type: 'god_man',
        created_by: 'test',
      })

      const list = await relatedContactsFor(xpand, db, 'P001000')

      expect(list).toEqual([
        expect.objectContaining({ contactCode: 'P000444', role: 'trustee' }),
      ])
    }))

  it('never lists a contact as its own related contact', () =>
    withContext(async ({ db }) => {
      // Nothing in the table prevents a self-edge; only the import's queries
      // and the read-path guard do.
      await db('contact_relation').insert({
        subject_contact_code: 'P000444',
        related_contact_code: 'P000444',
        role_type: 'god_man',
        created_by: 'test',
      })

      expect(await relatedContactsFor(xpand, db, 'P000444')).toEqual([])
      expect(
        await relatedContactsInRole(xpand, db, 'P000444', 'trustee')
      ).toEqual([])
      expect(
        await relatedContactsInRole(xpand, db, 'P000444', 'trusteeFor')
      ).toEqual([])
    }))
})

describe('relatedContactsInRole', () => {
  it('returns only the requested role and direction', () =>
    withContext(async ({ db }) => {
      await seed(db)

      // P000444 is förvaltare for P000555 and god man for P000666.
      expect(
        await relatedContactsInRole(xpand, db, 'P000444', 'administratorFor')
      ).toEqual([
        expect.objectContaining({
          contactCode: 'P000555',
          role: 'administratorFor',
        }),
      ])
      expect(
        await relatedContactsInRole(xpand, db, 'P000444', 'trusteeFor')
      ).toEqual([
        expect.objectContaining({
          contactCode: 'P000666',
          role: 'trusteeFor',
        }),
      ])
      // ...and is nobody's förvaltare in the other direction.
      expect(
        await relatedContactsInRole(xpand, db, 'P000444', 'administrator')
      ).toEqual([])
    }))

  it('hydrates names and redacts protected identities', () =>
    withContext(async ({ db }) => {
      await seed(db)

      expect(
        await relatedContactsInRole(xpand, db, 'P000777', 'administrator')
      ).toEqual([
        {
          contactCode: 'P000888',
          role: 'administrator',
          fullName: 'redacted',
          firstName: 'redacted',
          lastName: 'redacted',
        },
      ])
    }))

  it('ignores soft-deleted rows and drops counterparts missing from xpand', () =>
    withContext(async ({ db }) => {
      await seed(db)
      const [forvaltare] = (await listActive(db)).filter(
        (r) => r.subject_contact_code === 'P000555'
      )
      await softDeleteByIds(db, [forvaltare.id], 'test')

      expect(
        await relatedContactsInRole(xpand, db, 'P000555', 'administrator')
      ).toEqual([])
      expect(
        await relatedContactsInRole(xpand, db, 'P000333', 'trustee')
      ).toEqual([])
    }))

  it('returns [] for a blank code', () =>
    withContext(async ({ db }) => {
      expect(await relatedContactsInRole(xpand, db, '  ', 'trustee')).toEqual(
        []
      )
    }))
})
