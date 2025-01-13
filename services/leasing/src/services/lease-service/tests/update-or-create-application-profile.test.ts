import assert from 'node:assert'

import { updateOrCreateApplicationProfile } from '../update-or-create-application-profile'
import * as applicationProfileAdapter from '../adapters/application-profile-adapter'
import * as factory from './factories'
import { withContext } from './testUtils'

describe(updateOrCreateApplicationProfile.name, () => {
  describe('when no profile exists ', () => {
    it('creates application profile and housing reference', () =>
      withContext(async ({ db }) => {
        const res = await updateOrCreateApplicationProfile(db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'RENTAL',
          landlord: 'baz',
          housingTypeDescription: 'qux',
          housingReference: {
            comment: null,
            email: null,
            expiresAt: new Date(),
            lastAdminUpdatedAt: null,
            lastApplicantUpdatedAt: new Date(),
            phone: null,
            reasonRejected: null,
            reviewStatus: 'PENDING',
          },
        })

        expect(res).toMatchObject({ ok: true })
        const inserted = await applicationProfileAdapter.getByContactCode(
          db,
          '1234'
        )
        assert(inserted.ok)
        expect(inserted).toMatchObject({
          ok: true,
          data: expect.objectContaining({ contactCode: '1234' }),
        })
      }))
  })

  describe('when profile exists ', () => {
    it('updates application profile and housing reference', () =>
      withContext(async ({ db }) => {
        const existingProfile = await applicationProfileAdapter.create(
          db,
          '1234',
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
            housingReference: { email: 'foo' },
          })
        )
        assert(existingProfile.ok)

        const res = await updateOrCreateApplicationProfile(
          db,
          existingProfile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'RENTAL',
            landlord: 'quux',
            housingTypeDescription: 'corge',
            housingReference: {
              ...existingProfile.data.housingReference,
              email: 'bar',
            },
          }
        )
        assert(res.ok)

        expect(res).toMatchObject({ ok: true })
        const updated = await applicationProfileAdapter.getByContactCode(
          db,
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
  })
})
