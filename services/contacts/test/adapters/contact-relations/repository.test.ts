import config from '@src/common/config'
import { contactsDbClient } from '@src/adapters/db'
import {
  activeRelationsForMany,
  activeRelationsInRole,
  insertMany,
  listActive,
  softDeleteByIds,
} from '@src/adapters/contact-relations'
import {
  makeWithContext,
  requireContactsTestDb,
  resetContactRelations,
} from '../../db-support'

requireContactsTestDb()

const ACTOR = 'test-actor'
const OTHER_ACTOR = 'another-actor'

const dbResource = contactsDbClient(config.contactsDatabase)
const withContext = makeWithContext(dbResource)

beforeAll(async () => {
  await dbResource.init()
})

afterAll(async () => {
  await dbResource.close()
})

// The e2e fixture commits its rows, so a crashed e2e run can leave some
// behind; these cases assert whole-table contents inside their rollback
// transaction and would see them.
beforeEach(async () => {
  await resetContactRelations(dbResource.get())
})

describe('contact-relations repository', () => {
  // Fixtures respect the unique indexes from migration 202609101000: one
  // active guardian per subject, no duplicate active edges.
  it('insertMany writes one row per edge with the given creator', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000001',
            relatedContactCode: 'P000002',
            roleType: 'god_man',
          },
          {
            subjectContactCode: 'P000003',
            relatedContactCode: 'P000004',
            roleType: 'annan_fakturamottagare',
          },
        ],
        ACTOR
      )

      const rows = await listActive(db)
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.role_type).sort()).toEqual([
        'annan_fakturamottagare',
        'god_man',
      ])
      expect(rows[0].created_by).toBe(ACTOR)
      expect(rows[0].deleted_at).toBeNull()
    }))

  it('insertMany with an empty list is a no-op', () =>
    withContext(async ({ db }) => {
      await insertMany(db, [], ACTOR)
      expect(await listActive(db)).toEqual([])
    }))

  it('softDeleteByIds sets deleted_at and deleted_by and leaves other rows alone', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000001',
            relatedContactCode: 'P000002',
            roleType: 'god_man',
          },
          {
            subjectContactCode: 'P000003',
            relatedContactCode: 'P000004',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      const rows = await listActive(db)
      const target = rows.find((r) => r.subject_contact_code === 'P000001')!

      await softDeleteByIds(db, [target.id], ACTOR)

      const [deleted] = await db('contact_relation').where({ id: target.id })
      expect(deleted.deleted_at).toEqual(expect.any(Date))
      expect(deleted.deleted_by).toBe(ACTOR)

      const remaining = await listActive(db)
      expect(remaining.map((r) => r.subject_contact_code)).toEqual(['P000003'])
    }))

  it('softDeleteByIds with an empty list is a no-op', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000001',
            relatedContactCode: 'P000002',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )

      await softDeleteByIds(db, [], ACTOR)

      expect(await listActive(db)).toHaveLength(1)
    }))

  it('insertMany and softDeleteByIds handle more rows than one chunk', () =>
    withContext(async ({ db }) => {
      const edges = Array.from({ length: 1501 }, (_, i) => ({
        subjectContactCode: `P${String(i).padStart(6, '0')}`,
        relatedContactCode: `Q${String(i).padStart(6, '0')}`,
        roleType: 'god_man' as const,
      }))
      await insertMany(db, edges, ACTOR)
      const rows = await listActive(db)
      expect(rows).toHaveLength(1501)

      await softDeleteByIds(
        db,
        rows.map((r) => r.id),
        ACTOR
      )
      expect(await listActive(db)).toEqual([])
    }))

  it('softDeleteByIds leaves an already soft-deleted row untouched', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000001',
            relatedContactCode: 'P000002',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      const [row] = await listActive(db)

      await softDeleteByIds(db, [row.id], 'first-run')
      const [afterFirst] = await db('contact_relation').where({ id: row.id })
      await softDeleteByIds(db, [row.id], 'second-run')
      const [afterSecond] = await db('contact_relation').where({ id: row.id })

      expect(afterSecond.deleted_by).toBe('first-run')
      expect(afterSecond.deleted_at).toEqual(afterFirst.deleted_at)
    }))

  it('listActive returns active rows from every creator', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000001',
            relatedContactCode: 'P000002',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000005',
            relatedContactCode: 'P000006',
            roleType: 'forvaltare',
          },
        ],
        OTHER_ACTOR
      )

      const rows = await listActive(db)

      expect(rows.map((r) => r.created_by).sort()).toEqual(
        [OTHER_ACTOR, ACTOR].sort()
      )
    }))

  it('listActive excludes soft-deleted rows', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P000001',
            relatedContactCode: 'P000002',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      const [row] = await listActive(db)
      await softDeleteByIds(db, [row.id], ACTOR)

      expect(await listActive(db)).toEqual([])
    }))

  it('activeRelationsForMany returns active rows where a requested code is subject or related, and ignores soft-deleted rows on either side', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P2',
            roleType: 'god_man',
          },
          {
            subjectContactCode: 'P3',
            relatedContactCode: 'P1',
            roleType: 'annan_fakturamottagare',
          },
          {
            subjectContactCode: 'P4',
            relatedContactCode: 'P5',
            roleType: 'forvaltare',
          },
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P6',
            roleType: 'annan_fakturamottagare',
          },
          {
            subjectContactCode: 'P7',
            relatedContactCode: 'P1',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      const toDelete = (await listActive(db)).filter(
        (r) =>
          r.related_contact_code === 'P6' || r.subject_contact_code === 'P7'
      )
      await softDeleteByIds(
        db,
        toDelete.map((r) => r.id),
        ACTOR
      )

      const rows = await activeRelationsForMany(db, ['P1'])

      expect(
        rows
          .map((r) => [
            r.subject_contact_code,
            r.related_contact_code,
            r.role_type,
          ])
          .sort()
      ).toEqual([
        ['P1', 'P2', 'god_man'],
        ['P3', 'P1', 'annan_fakturamottagare'],
      ])
    }))

  it('activeRelationsForMany trims requested codes', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P2',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      expect(await activeRelationsForMany(db, [' P1 '])).toHaveLength(1)
    }))

  it('activeRelationsForMany returns an empty list for no codes', () =>
    withContext(async ({ db }) => {
      expect(await activeRelationsForMany(db, [])).toEqual([])
    }))

  it('activeRelationsForMany reads more codes than one chunk and dedupes the request', () =>
    withContext(async ({ db }) => {
      const edges = Array.from({ length: 1201 }, (_, i) => ({
        subjectContactCode: `P${String(i).padStart(6, '0')}`,
        relatedContactCode: `Q${String(i).padStart(6, '0')}`,
        roleType: 'god_man' as const,
      }))
      await insertMany(db, edges, ACTOR)

      const codes = [
        ...edges.map((e) => e.subjectContactCode),
        ...edges.map((e) => e.subjectContactCode),
      ]
      const rows = await activeRelationsForMany(db, codes)

      expect(rows).toHaveLength(1201)
    }))

  it('activeRelationsForMany returns each row once when both sides are requested', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P2',
            roleType: 'god_man',
          },
          {
            subjectContactCode: 'P3',
            relatedContactCode: 'P4',
            roleType: 'forvaltare',
          },
        ],
        ACTOR
      )

      const rows = await activeRelationsForMany(db, ['P1', 'P2', 'P3'])

      expect(
        rows
          .map((r) => [
            r.subject_contact_code,
            r.related_contact_code,
            r.role_type,
          ])
          .sort()
      ).toEqual([
        ['P1', 'P2', 'god_man'],
        ['P3', 'P4', 'forvaltare'],
      ])
    }))

  it('activeRelationsForMany returns a row once even when its two endpoints fall in different read chunks', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'A000000',
            relatedContactCode: 'B000000',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )

      // The chunk loop matches either endpoint, so asking for both sides far
      // enough apart puts them in separate queries.
      const filler = Array.from(
        { length: 1200 },
        (_, i) => `F${String(i).padStart(6, '0')}`
      )
      const rows = await activeRelationsForMany(db, [
        'A000000',
        ...filler,
        'B000000',
      ])

      expect(rows).toHaveLength(1)
    }))

  it('activeRelationsInRole returns only rows of that role type on that side of the edge', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P2',
            roleType: 'god_man',
          },
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P3',
            roleType: 'annan_fakturamottagare',
          },
          {
            subjectContactCode: 'P4',
            relatedContactCode: 'P1',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )

      expect(
        (await activeRelationsInRole(db, 'P1', 'god_man', 'subject')).map(
          (r) => r.related_contact_code
        )
      ).toEqual(['P2'])
      expect(
        (await activeRelationsInRole(db, 'P1', 'god_man', 'related')).map(
          (r) => r.subject_contact_code
        )
      ).toEqual(['P4'])
      expect(
        await activeRelationsInRole(db, 'P1', 'forvaltare', 'subject')
      ).toEqual([])
    }))

  it('activeRelationsInRole trims the requested code, skips blanks and ignores soft-deleted rows', () =>
    withContext(async ({ db }) => {
      // Inserted and soft-deleted before P1->P2 so P1 never carries two
      // active guardians at once.
      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P3',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )
      const [gone] = await listActive(db)
      await softDeleteByIds(db, [gone.id], ACTOR)

      await insertMany(
        db,
        [
          {
            subjectContactCode: 'P1',
            relatedContactCode: 'P2',
            roleType: 'god_man',
          },
        ],
        ACTOR
      )

      expect(
        (await activeRelationsInRole(db, ' P1 ', 'god_man', 'subject')).map(
          (r) => r.related_contact_code
        )
      ).toEqual(['P2'])
      expect(
        await activeRelationsInRole(db, '  ', 'god_man', 'subject')
      ).toEqual([])
    }))
})
