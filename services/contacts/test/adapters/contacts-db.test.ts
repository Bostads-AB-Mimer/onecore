import { Knex } from 'knex'
import config from '@src/common/config'
import { contactsDbClient } from '@src/adapters/db'

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

describe('contact_relation', () => {
  it('round-trips a row with defaults applied', () =>
    withContext(async ({ db }) => {
      await db('contact_relation').insert({
        subject_contact_code: 'P123456',
        related_contact_code: 'P654321',
        role_type: 'god_man',
        created_by: 'test-user',
      })

      const rows = await db('contact_relation').where({
        subject_contact_code: 'P123456',
      })

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        subject_contact_code: 'P123456',
        related_contact_code: 'P654321',
        role_type: 'god_man',
        created_by: 'test-user',
        deleted_at: null,
        deleted_by: null,
      })
      expect(rows[0].id).toEqual(expect.any(String))
      expect(rows[0].created_at).toEqual(expect.any(Date))
    }))

  it('soft-deletes by setting deleted_at and deleted_by', () =>
    withContext(async ({ db }) => {
      await db('contact_relation').insert({
        subject_contact_code: 'P123456',
        related_contact_code: 'P654321',
        role_type: 'forvaltare',
        created_by: 'test-user',
      })

      await db('contact_relation')
        .where({ subject_contact_code: 'P123456' })
        .update({ deleted_at: new Date(), deleted_by: 'test-user' })

      const [row] = await db('contact_relation').where({
        subject_contact_code: 'P123456',
      })

      expect(row.deleted_at).toEqual(expect.any(Date))
      expect(row.deleted_by).toEqual('test-user')
    }))

  it('rejects unknown role_type values', () =>
    withContext(async ({ db }) => {
      await expect(
        db('contact_relation').insert({
          subject_contact_code: 'P123456',
          related_contact_code: 'P654321',
          role_type: 'nyttjare',
          created_by: 'test-user',
        })
      ).rejects.toThrow()
    }))
})
