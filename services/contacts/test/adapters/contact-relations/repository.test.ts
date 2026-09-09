import config from '@src/common/config'
import { contactsDbClient } from '@src/adapters/db'
import {
  activeRelationsForMany,
  insertMany,
  listActive,
  softDeleteByIds,
} from '@src/adapters/contact-relations'
import { makeWithContext, requireContactsTestDb } from '../../db-support'

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

describe('contact-relations repository', () => {
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

  it('activeRelationsForMany returns active rows where a requested code is subject or related', () =>
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
            roleType: 'forvaltare',
          },
        ],
        ACTOR
      )
      const [toDelete] = (await listActive(db)).filter(
        (r) => r.related_contact_code === 'P6'
      )
      await softDeleteByIds(db, [toDelete.id], ACTOR)

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
      expect(await activeRelationsForMany(db, ['P1  '])).toHaveLength(1)
    }))

  it('activeRelationsForMany returns an empty list for no codes', () =>
    withContext(async ({ db }) => {
      expect(await activeRelationsForMany(db, [])).toEqual([])
    }))
})
