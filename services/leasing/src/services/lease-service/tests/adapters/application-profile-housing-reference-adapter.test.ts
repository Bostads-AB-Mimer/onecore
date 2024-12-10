import assert from 'node:assert'

import { db, migrate, teardown } from '../../adapters/db'
import * as adapter from '../../adapters/application-profile-housing-reference-adapter'
import * as applicationProfileAdapter from '../../adapters/application-profile-adapter'
import { clearDb } from '../testUtils'

beforeAll(async () => {
  await migrate()
})

afterEach(async () => {
  await clearDb(db)
})

afterAll(async () => {
  await teardown()
})

async function createApplicationProfile() {
  const profile = await applicationProfileAdapter.create(db, {
    contactCode: '1234',
    expiresAt: new Date(),
    numAdults: 1,
    numChildren: 1,
  })

  assert(profile.ok)
  return profile.data
}

describe('application-profile-housing-reference-adapter', () => {
  describe(adapter.create, () => {
    it('inserts application profile housing reference', async () => {
      const applicationProfile = await createApplicationProfile()
      const reference = await adapter.create(db, {
        applicationProfileId: applicationProfile.id,
        email: null,
        phone: '01234',
        reviewStatus: 'foo',
        reviewStatusReason: null,
        reviewedAt: null,
        expiresAt: new Date(),
      })

      assert(reference.ok)

      const inserted = await adapter.findByApplicationProfileId(
        db,
        applicationProfile.id
      )

      assert(inserted.ok)

      expect(inserted.data).toEqual({
        id: expect.any(Number),
        applicationProfileId: applicationProfile.id,
        email: null,
        phone: '01234',
        reviewStatus: 'foo',
        reviewStatusReason: null,
        reviewedAt: null,
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
      })
    })

    it('rejects duplicate application profile id', async () => {
      const applicationProfile = await createApplicationProfile()
      const reference = await adapter.create(db, {
        applicationProfileId: applicationProfile.id,
        email: null,
        phone: '01234',
        reviewStatus: 'foo',
        reviewStatusReason: null,
        reviewedAt: null,
        expiresAt: new Date(),
      })

      const duplicateReference = await adapter.create(db, {
        applicationProfileId: applicationProfile.id,
        email: null,
        phone: '01234',
        reviewStatus: 'foo',
        reviewStatusReason: null,
        reviewedAt: null,
        expiresAt: new Date(),
      })

      assert(reference.ok)
      expect(duplicateReference).toEqual({
        ok: false,
        err: 'conflict-application-profile-id',
      })
    })
  })

  describe(adapter.update, () => {
    it('returns err if no update', async () => {
      const result = await adapter.update(db, 1, {
        email: null,
        phone: '01234',
        reviewStatus: 'foo',
        reviewStatusReason: null,
        reviewedAt: null,
        expiresAt: new Date(),
      })

      expect(result).toMatchObject({ ok: false, err: 'no-update' })
    })

    it('updates application profile', async () => {
      const profile = await createApplicationProfile()

      await adapter.create(db, {
        applicationProfileId: profile.id,
        email: null,
        phone: '01234',
        reviewStatus: 'foo',
        reviewStatusReason: null,
        reviewedAt: null,
        expiresAt: new Date(),
      })

      await adapter.update(db, profile.id, {
        email: null,
        phone: '01234',
        reviewStatus: 'bar',
        reviewStatusReason: null,
        reviewedAt: new Date(),
        expiresAt: new Date(),
      })

      const updated = await adapter.findByApplicationProfileId(db, profile.id)

      assert(updated.ok)
      expect(updated.data).toMatchObject({
        applicationProfileId: profile.id,
        reviewStatus: 'bar',
        reviewedAt: expect.any(Date),
      })
    })
  })
})
