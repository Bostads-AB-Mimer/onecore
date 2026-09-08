import { Knex } from 'knex'
import config from '@src/common/config'
import { contactsDbClient } from '@src/adapters/db'
import {
  insertMany,
  listActiveByCreator,
  softDeleteByIds,
} from '@src/adapters/contact-relations'

if (config.contactsDatabase.database !== 'contacts-test') {
  throw new Error(
    `Refusing to run against database "${config.contactsDatabase.database}". Must be "contacts-test".`
  )
}

const dbResource = contactsDbClient(config.contactsDatabase)

beforeAll(async () => {
  await dbResource.init()
})

afterAll(async () => {
  await dbResource.close()
})

const withContext = async (
  callback: (ctx: { db: Knex.Transaction }) => Promise<unknown>
) => {
  try {
    await dbResource.get().transaction(async (trx) => {
      await callback({ db: trx })
      throw 'rollback'
    })
  } catch (e: unknown) {
    if (e === 'rollback') return
    throw e
  }
}

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
        'xpand-import'
      )

      const rows = await listActiveByCreator(db, 'xpand-import')
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.role_type).sort()).toEqual([
        'annan_fakturamottagare',
        'god_man',
      ])
      expect(rows[0].created_by).toBe('xpand-import')
      expect(rows[0].deleted_at).toBeNull()
    }))

  it('insertMany with an empty list is a no-op', () =>
    withContext(async ({ db }) => {
      await insertMany(db, [], 'xpand-import')
      expect(await listActiveByCreator(db, 'xpand-import')).toEqual([])
    }))

  it('listActiveByCreator excludes soft-deleted rows and other creators', () =>
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
        'xpand-import'
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
        'someone-else'
      )
      const [row] = await listActiveByCreator(db, 'xpand-import')
      await softDeleteByIds(db, [row.id], 'xpand-import')

      expect(await listActiveByCreator(db, 'xpand-import')).toEqual([])
      expect(await listActiveByCreator(db, 'someone-else')).toHaveLength(1)
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
        'xpand-import'
      )
      const rows = await listActiveByCreator(db, 'xpand-import')
      const target = rows.find((r) => r.subject_contact_code === 'P000001')!

      await softDeleteByIds(db, [target.id], 'xpand-import')

      const [deleted] = await db('contact_relation').where({ id: target.id })
      expect(deleted.deleted_at).toEqual(expect.any(Date))
      expect(deleted.deleted_by).toBe('xpand-import')

      const remaining = await listActiveByCreator(db, 'xpand-import')
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
        'xpand-import'
      )

      await softDeleteByIds(db, [], 'xpand-import')

      expect(await listActiveByCreator(db, 'xpand-import')).toHaveLength(1)
    }))

  it('insertMany and softDeleteByIds handle more rows than one chunk', () =>
    withContext(async ({ db }) => {
      const edges = Array.from({ length: 1501 }, (_, i) => ({
        subjectContactCode: `P${String(i).padStart(6, '0')}`,
        relatedContactCode: `Q${String(i).padStart(6, '0')}`,
        roleType: 'god_man' as const,
      }))
      await insertMany(db, edges, 'xpand-import')
      const rows = await listActiveByCreator(db, 'xpand-import')
      expect(rows).toHaveLength(1501)

      await softDeleteByIds(
        db,
        rows.map((r) => r.id),
        'xpand-import'
      )
      expect(await listActiveByCreator(db, 'xpand-import')).toEqual([])
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
        'xpand-import'
      )
      const [row] = await listActiveByCreator(db, 'xpand-import')

      await softDeleteByIds(db, [row.id], 'first-run')
      const [afterFirst] = await db('contact_relation').where({ id: row.id })
      await softDeleteByIds(db, [row.id], 'second-run')
      const [afterSecond] = await db('contact_relation').where({ id: row.id })

      expect(afterSecond.deleted_by).toBe('first-run')
      expect(afterSecond.deleted_at).toEqual(afterFirst.deleted_at)
    }))
})
