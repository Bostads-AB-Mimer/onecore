import assert from 'node:assert'
import { Knex } from 'knex'

import * as adapter from '../../adapters/application-profile-housing-reference-adapter'
import * as applicationProfileAdapter from '../../adapters/application-profile-adapter'
import { withContext } from '../testUtils'

async function createApplicationProfile(db: Knex) {
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
    it('inserts application profile housing reference', () =>
      withContext(async (ctx) => {
        const applicationProfile = await createApplicationProfile(ctx.db)
        const reference = await adapter.create(ctx.db, {
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
          ctx.db,
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
      }))

    it('rejects duplicate application profile id', () =>
      withContext(async (ctx) => {
        const applicationProfile = await createApplicationProfile(ctx.db)
        const reference = await adapter.create(ctx.db, {
          applicationProfileId: applicationProfile.id,
          email: null,
          phone: '01234',
          reviewStatus: 'foo',
          reviewStatusReason: null,
          reviewedAt: null,
          expiresAt: new Date(),
        })

        const duplicateReference = await adapter.create(ctx.db, {
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
      }))
  })

  describe(adapter.update, () => {
    it('returns err if no update', () =>
      withContext(async (ctx) => {
        const result = await adapter.update(ctx.db, 1, {
          email: null,
          phone: '01234',
          reviewStatus: 'foo',
          reviewStatusReason: null,
          reviewedAt: null,
          expiresAt: new Date(),
        })

        expect(result).toMatchObject({ ok: false, err: 'no-update' })
      }))

    it('updates application profile', () =>
      withContext(async (ctx) => {
        const profile = await createApplicationProfile(ctx.db)

        await adapter.create(ctx.db, {
          applicationProfileId: profile.id,
          email: null,
          phone: '01234',
          reviewStatus: 'foo',
          reviewStatusReason: null,
          reviewedAt: null,
          expiresAt: new Date(),
        })

        await adapter.update(ctx.db, profile.id, {
          email: null,
          phone: '01234',
          reviewStatus: 'bar',
          reviewStatusReason: null,
          reviewedAt: new Date(),
          expiresAt: new Date(),
        })

        const updated = await adapter.findByApplicationProfileId(
          ctx.db,
          profile.id
        )

        assert(updated.ok)
        expect(updated.data).toMatchObject({
          applicationProfileId: profile.id,
          reviewStatus: 'bar',
          reviewedAt: expect.any(Date),
        })
      }))
  })
})
