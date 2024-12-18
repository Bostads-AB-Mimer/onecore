import assert from 'node:assert'
import { ApplicationProfile } from 'onecore-types'

import * as applicationProfileAdapter from '../adapters/application-profile-adapter'
import * as housingReferenceAdapter from '../adapters/application-profile-housing-reference-adapter'
import * as factory from './factories'
import { updateOrCreateApplicationProfile } from '../update-or-create-application-profile'
import { withContext } from './testUtils'

describe(updateOrCreateApplicationProfile.name, () => {
  describe('when no profile exists', () => {
    it('creates application profile', () =>
      withContext(async (ctx) => {
        const res = await updateOrCreateApplicationProfile(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'foo',
          landlord: 'baz',
          housingTypeDescription: 'qux',
        })

        expect(res).toMatchObject({ ok: true })
        const inserted = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )
        assert(inserted.ok)
        expect(inserted).toMatchObject({
          ok: true,
          data: expect.objectContaining({ contactCode: '1234' }),
        })
      }))

    it('creates application profile and housing reference', () =>
      withContext(async (ctx) => {
        const res = await updateOrCreateApplicationProfile(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'foo',
          landlord: 'baz',
          housingTypeDescription: 'qux',
          housingReference: factory.applicationProfileHousingReference.build(),
        })

        expect(res).toMatchObject({ ok: true })
        const insertedProfile =
          await applicationProfileAdapter.getByContactCode(ctx.db, '1234')
        assert(insertedProfile.ok)
        expect(insertedProfile).toMatchObject({
          ok: true,
          data: expect.objectContaining<Partial<ApplicationProfile>>({
            contactCode: '1234',
            housingReference: expect.objectContaining({
              id: expect.any(Number),
            }),
          }),
        })
      }))

    it('if create reference fails, profile is not created', () =>
      withContext(async (ctx) => {
        jest
          .spyOn(housingReferenceAdapter, 'create')
          .mockResolvedValueOnce({ ok: false, err: 'unknown' })

        const res = await updateOrCreateApplicationProfile(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'foo',
          landlord: 'baz',
          housingTypeDescription: 'qux',
          housingReference: factory.applicationProfileHousingReference.build(),
        })

        expect(res).toMatchObject({
          ok: false,
          err: 'create-reference',
        })

        const insertedProfile =
          await applicationProfileAdapter.getByContactCode(ctx.db, '1234')

        expect(insertedProfile).toMatchObject({ ok: false, err: 'not-found' })
      }))
  })

  describe('when profile exists', () => {
    it('updates application profile', () =>
      withContext(async (ctx) => {
        const existingProfile = await applicationProfileAdapter.create(
          ctx.db,
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
          })
        )
        assert(existingProfile.ok)

        const res = await updateOrCreateApplicationProfile(
          ctx.db,
          existingProfile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'bar',
            landlord: 'quux',
            housingTypeDescription: 'corge',
          }
        )

        expect(res).toMatchObject({ ok: true })
        const updated = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )
        assert(updated.ok)
        expect(updated).toMatchObject({
          ok: true,
          data: expect.objectContaining({
            contactCode: '1234',
            numAdults: 2,
          }),
        })
      }))

    it('updates application profile and housing reference', () =>
      withContext(async (ctx) => {
        const existingProfile = await applicationProfileAdapter.create(
          ctx.db,
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
          })
        )
        assert(existingProfile.ok)

        const existingReference = await housingReferenceAdapter.create(
          ctx.db,
          factory.applicationProfileHousingReference.build({
            applicationProfileId: existingProfile.data.id,
            email: 'foo',
          })
        )

        assert(existingReference.ok)

        const res = await updateOrCreateApplicationProfile(
          ctx.db,
          existingProfile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'bar',
            landlord: 'quux',
            housingTypeDescription: 'corge',
            housingReference: { ...existingReference.data, email: 'bar' },
          }
        )
        assert(res.ok)

        expect(res).toMatchObject({ ok: true })
        const updated = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )
        assert(updated.ok)
        expect(updated).toMatchObject({
          ok: true,
          data: expect.objectContaining({
            contactCode: '1234',
            numAdults: 2,
            housingReference: expect.objectContaining({
              applicationProfileId: existingProfile.data.id,
              email: 'bar',
            }),
          }),
        })
      }))

    it('updates application profile and creates housing reference', () =>
      withContext(async (ctx) => {
        const existingProfile = await applicationProfileAdapter.create(
          ctx.db,
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
          })
        )
        assert(existingProfile.ok)

        const res = await updateOrCreateApplicationProfile(
          ctx.db,
          existingProfile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'bar',
            landlord: 'quux',
            housingTypeDescription: 'corge',
            housingReference: {
              ...factory.applicationProfileHousingReference.build({
                email: 'foo',
              }),
            },
          }
        )
        assert(res.ok)

        expect(res).toMatchObject({ ok: true })
        const updated = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )
        assert(updated.ok)
        expect(updated).toMatchObject({
          ok: true,
          data: expect.objectContaining({
            contactCode: '1234',
            numAdults: 2,
            housingReference: expect.objectContaining({
              applicationProfileId: existingProfile.data.id,
              email: 'foo',
            }),
          }),
        })
      }))

    it('if update reference fails, profile is not updated', () =>
      withContext(async (ctx) => {
        const existingProfile = await applicationProfileAdapter.create(
          ctx.db,
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
          })
        )
        assert(existingProfile.ok)

        const existingReference = await housingReferenceAdapter.create(
          ctx.db,
          factory.applicationProfileHousingReference.build({
            applicationProfileId: existingProfile.data.id,
            email: 'foo',
          })
        )

        assert(existingReference.ok)

        jest
          .spyOn(housingReferenceAdapter, 'update')
          .mockResolvedValueOnce({ ok: false, err: 'no-update' })

        const res = await updateOrCreateApplicationProfile(
          ctx.db,
          existingProfile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'bar',
            landlord: 'quux',
            housingTypeDescription: 'corge',
            housingReference: { ...existingReference.data, email: 'bar' },
          }
        )

        expect(res).toMatchObject({ ok: false, err: 'create-reference' })
        const updated = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )
        assert(updated.ok)
        expect(updated).toMatchObject({
          ok: true,
          data: expect.objectContaining({
            contactCode: '1234',
            numAdults: 1,
            housingReference: expect.objectContaining({
              applicationProfileId: existingProfile.data.id,
              email: 'foo',
            }),
          }),
        })
      }))
  })
})
