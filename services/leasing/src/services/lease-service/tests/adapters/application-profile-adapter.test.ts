import assert from 'node:assert'

import * as applicationProfileAdapter from '../../adapters/application-profile-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

describe('application-profile-adapter', () => {
  describe(applicationProfileAdapter.create, () => {
    it('creates application profile', () =>
      withContext(async (ctx) => {
        const profile = await applicationProfileAdapter.create(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'RENTAL',
          housingTypeDescription: 'bar',
          landlord: 'baz',
          housingReference: factory.applicationProfileHousingReference.build(),
          lastUpdatedAt: new Date(),
        })
        assert(profile.ok)

        const inserted = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          profile.data.contactCode
        )

        assert(inserted.ok)
        expect(inserted).toMatchObject({ ok: true, data: profile.data })
      }))

    it('fails if existing profile for contact code already exists', () =>
      withContext(async (ctx) => {
        const profile = await applicationProfileAdapter.create(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'RENTAL',
          housingTypeDescription: 'bar',
          landlord: 'baz',
          housingReference: factory.applicationProfileHousingReference.build(),
          lastUpdatedAt: new Date(),
        })

        assert(profile.ok)

        const duplicate = await applicationProfileAdapter.create(
          ctx.db,
          '1234',
          {
            expiresAt: new Date(),
            numAdults: 1,
            numChildren: 1,
            housingType: 'RENTAL',
            housingTypeDescription: 'bar',
            landlord: 'baz',
            housingReference:
              factory.applicationProfileHousingReference.build(),
            lastUpdatedAt: new Date(),
          }
        )

        expect(duplicate).toMatchObject({
          ok: false,
          err: 'conflict-contact-code',
        })
      }))
  })

  describe(applicationProfileAdapter.getByContactCode, () => {
    it('returns err if not found', () =>
      withContext(async (ctx) => {
        const result = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )
        expect(result).toMatchObject({ ok: false, err: 'not-found' })
      }))

    it('gets application profile', () =>
      withContext(async (ctx) => {
        await applicationProfileAdapter.create(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'RENTAL',
          housingTypeDescription: 'bar',
          landlord: 'baz',
          housingReference: factory.applicationProfileHousingReference.build(),

          lastUpdatedAt: new Date(),
        })

        const result = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          '1234'
        )

        expect(result).toMatchObject({
          ok: true,
          data: {
            id: expect.any(Number),
            contactCode: '1234',
            numAdults: 1,
            numChildren: 1,
            expiresAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        })
      }))
  })

  describe(applicationProfileAdapter.update, () => {
    it('returns err if no update', () =>
      withContext(async (ctx) => {
        const result = await applicationProfileAdapter.update(
          ctx.db,
          'contact-code',
          {
            expiresAt: new Date(),
            numAdults: 1,
            numChildren: 1,
            housingType: 'RENTAL',
            housingTypeDescription: 'bar',
            landlord: 'baz',
            housingReference:
              factory.applicationProfileHousingReference.build(),
            lastUpdatedAt: new Date(),
          }
        )

        expect(result).toMatchObject({ ok: false, err: 'no-update' })
      }))

    it('updates application profile', () =>
      withContext(async (ctx) => {
        const profile = await applicationProfileAdapter.create(ctx.db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'RENTAL',
          housingTypeDescription: 'bar',
          landlord: 'baz',
          housingReference: factory.applicationProfileHousingReference.build(),
          lastUpdatedAt: new Date(),
        })

        assert(profile.ok)
        await applicationProfileAdapter.update(
          ctx.db,
          profile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'RENTAL',
            housingTypeDescription: 'bar',
            landlord: 'baz',
            housingReference:
              factory.applicationProfileHousingReference.build(),
            lastUpdatedAt: new Date(),
          }
        )

        const updated = await applicationProfileAdapter.getByContactCode(
          ctx.db,
          profile.data.contactCode
        )

        expect(updated).toMatchObject({
          ok: true,
          data: {
            id: expect.any(Number),
            contactCode: '1234',
            numAdults: 2,
            numChildren: 2,
            expiresAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        })
      }))
  })
})
