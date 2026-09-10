import config from '@src/common/config'
import { contactsDbClient } from '@src/adapters/db'
import {
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
const dbResource = contactsDbClient(config.contactsDatabase)
const withContext = makeWithContext(dbResource)

beforeAll(async () => {
  await dbResource.init()
})

beforeEach(async () => {
  await resetContactRelations(dbResource.get())
})

afterAll(async () => {
  await dbResource.close()
})

const edge = (
  subject: string,
  related: string,
  roleType: 'god_man' | 'forvaltare' | 'annan_fakturamottagare'
) => ({ subjectContactCode: subject, relatedContactCode: related, roleType })

describe('contact_relation unique indexes', () => {
  it('rejects a second active row for the same edge', () =>
    withContext(async ({ db }) => {
      await insertMany(db, [edge('P1', 'P2', 'annan_fakturamottagare')], ACTOR)
      await expect(
        insertMany(db, [edge('P1', 'P2', 'annan_fakturamottagare')], ACTOR)
      ).rejects.toMatchObject({ number: 2601 })
    }))

  it('rejects a second active guardian of any type for the same subject', () =>
    withContext(async ({ db }) => {
      await insertMany(db, [edge('P1', 'P2', 'god_man')], ACTOR)
      await expect(
        insertMany(db, [edge('P1', 'P3', 'forvaltare')], ACTOR)
      ).rejects.toMatchObject({ number: 2601 })
    }))

  it('allows a new guardian once the previous one is soft-deleted', () =>
    withContext(async ({ db }) => {
      await insertMany(db, [edge('P1', 'P2', 'god_man')], ACTOR)
      const [old] = await listActive(db)
      await softDeleteByIds(db, [old.id], ACTOR)

      await insertMany(db, [edge('P1', 'P3', 'forvaltare')], ACTOR)

      const active = await listActive(db)
      expect(active.map((r) => r.related_contact_code)).toEqual(['P3'])
    }))

  it('allows several active fakturamottagare for the same subject', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          edge('P1', 'P2', 'annan_fakturamottagare'),
          edge('P1', 'P3', 'annan_fakturamottagare'),
        ],
        ACTOR
      )
      expect(await listActive(db)).toHaveLength(2)
    }))

  it('allows a fakturamottagare alongside a guardian', () =>
    withContext(async ({ db }) => {
      await insertMany(
        db,
        [
          edge('P1', 'P2', 'god_man'),
          edge('P1', 'P3', 'annan_fakturamottagare'),
        ],
        ACTOR
      )
      expect(await listActive(db)).toHaveLength(2)
    }))
})
