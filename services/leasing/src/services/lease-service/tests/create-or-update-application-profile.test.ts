import assert from 'node:assert'
import { leasing } from 'onecore-types'
import { z } from 'zod'
import { createOrUpdateApplicationProfile } from '../create-or-update-application-profile'
import * as applicationProfileAdapter from '../adapters/application-profile-adapter'
import * as factory from './factories'
import { withContext } from './testUtils'
import { addDays, addMonths } from 'date-fns'

type CreateOrUpdatePayload = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema
>

describe(createOrUpdateApplicationProfile.name, () => {
  describe('when no profile exists ', () => {
    it('creates application profile and housing reference', () =>
      withContext(async ({ db }) => {
        const res = await createOrUpdateApplicationProfile(db, '1234', {
          expiresAt: new Date(),
          numAdults: 1,
          numChildren: 1,
          housingType: 'RENTAL',
          landlord: 'baz',
          housingTypeDescription: 'qux',
          lastUpdatedAt: new Date(),
          housingReference: {
            comment: null,
            email: null,
            expiresAt: new Date(),
            reviewedAt: null,
            reviewedBy: null,
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
    beforeEach(() => {
      jest.useFakeTimers({
        advanceTimers: false,
        doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick'],
      })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

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

        const res = await createOrUpdateApplicationProfile(
          db,
          existingProfile.data.contactCode,
          {
            expiresAt: new Date(),
            numAdults: 2,
            numChildren: 2,
            housingType: 'RENTAL',
            landlord: 'quux',
            housingTypeDescription: 'corge',
            lastUpdatedAt: new Date(),
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

    it('updates the approval time when a review status-update is processed', () =>
      withContext(async ({ db }) => {
        // Given
        const startTime = new Date()
        jest.setSystemTime(startTime)

        // ...an existing application profile
        const existingProfile = await applicationProfileAdapter.create(
          db,
          '1234',
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
            housingReference: {
              email: 'foo@bar.baz',
              reviewStatus: 'PENDING',
            },
          })
        )
        assert(existingProfile.ok)

        const original = await applicationProfileAdapter.getByContactCode(
          db,
          '1234'
        )
        assert(original.ok)

        // When
        // ...two days later
        const updateTime = addDays(startTime, 2)
        jest.setSystemTime(updateTime)

        // ...the application is approved.
        const updatedResponse = await createOrUpdateApplicationProfile(
          db,
          '1234',
          {
            ...(original.data as CreateOrUpdatePayload),
            housingReference: {
              ...original.data.housingReference,
              reviewStatus: 'APPROVED',
            },
          }
        )

        // Then
        // ...the update is successful
        assert(updatedResponse.ok)
        const [action, updated] = updatedResponse.data
        expect(action).toBe('updated')

        // ...createdAt is unchanged
        expect(updated.createdAt).toEqual(original.data.createdAt)

        // ...lastUpdatedAt is unchanged
        expect(updated.lastUpdatedAt).toBeNearDate(original.data.createdAt)

        // ...housingReference.reviewedAt has changed to the time of the approval
        expect(updated.housingReference.reviewedAt).toBeNearDate(updateTime)

        // ...housingReference.expiresAt is unchanged
        expect(updated.housingReference.expiresAt).toEqual(
          original.data.housingReference.expiresAt
        )
      }))

    it('updates lastUpdatedAt and expiresAt when the reference data is updated', () =>
      withContext(async ({ db }) => {
        // Given
        const startTime = new Date()
        jest.setSystemTime(startTime)

        // ...an existing APPROVED application profile
        const existingProfile = await applicationProfileAdapter.create(
          db,
          '1234',
          factory.applicationProfile.build({
            contactCode: '1234',
            housingType: 'OWNS_FLAT',
            housingReference: {
              email: 'foo@bar.baz',
              reviewStatus: 'APPROVED',
              reviewedAt: new Date('2025-05-13 14:33:00'),
            },
            lastUpdatedAt: new Date('2025-05-11 17:00:00'),
            createdAt: new Date('2025-05-11 17:00:00'),
          })
        )
        assert(existingProfile.ok)
        const original = await applicationProfileAdapter.getByContactCode(
          db,
          '1234'
        )
        assert(original.ok)

        // When
        // ...two days later
        const updateTime = addDays(startTime, 2)
        jest.setSystemTime(updateTime)

        // ...the application details are changed.
        const updatedResponse = await createOrUpdateApplicationProfile(
          db,
          '1234',
          {
            ...(original.data as CreateOrUpdatePayload),
            housingType: 'LODGER',
            housingReference: {
              ...original.data.housingReference,
            },
          }
        )

        // Then
        // ...the update is successful
        assert(updatedResponse.ok)
        const [action, updated] = updatedResponse.data
        expect(action).toBe('updated')

        // ...createdAt is unchanged
        expect(updated.createdAt).toEqual(original.data.createdAt)

        // ...expiresAt is 6 months from "now"
        expect(updated.expiresAt).toBeNearDate(addMonths(updateTime, 6))

        // ...lastUpdatedAt is changed to "now"
        expect(updated.lastUpdatedAt).toBeNearDate(updateTime)

        // ...housingReference.reviewedAt is unchanged
        expect(updated.housingReference.reviewedAt).toEqual(
          original.data.housingReference.reviewedAt
        )

        // ...housingReference.expiresAt is unchanged
        expect(updated.housingReference.expiresAt).toEqual(
          original.data.housingReference.expiresAt
        )
      }))

    it('only updates expiresAt if only the number of tenants is updated', () =>
      withContext(async ({ db }) => {
        // Given
        const startTime = new Date()
        jest.setSystemTime(startTime)

        // ...an existing APPROVED application profile
        const existingProfile = await applicationProfileAdapter.create(
          db,
          '1234',
          factory.applicationProfile.build({
            contactCode: '1234',
            numAdults: 1,
            numChildren: 0,
            housingReference: {
              email: 'foo@bar.baz',
              reviewStatus: 'APPROVED',
              reviewedAt: new Date('2025-05-13 14:33:00'),
            },
            lastUpdatedAt: new Date('2025-05-11 17:00:00'),
            createdAt: new Date('2025-05-11 17:00:00'),
          })
        )
        assert(existingProfile.ok)
        const original = await applicationProfileAdapter.getByContactCode(
          db,
          '1234'
        )
        assert(original.ok)

        // When
        // ...two days later
        const updateTime = addDays(startTime, 2)
        jest.setSystemTime(updateTime)

        // ...the application details are changed.
        const updatedResponse = await createOrUpdateApplicationProfile(
          db,
          '1234',
          {
            ...(original.data as CreateOrUpdatePayload),
            numAdults: 2,
            numChildren: 1,
            housingReference: {
              ...original.data.housingReference,
            },
          }
        )

        // Then
        // ...the update is successful
        assert(updatedResponse.ok)
        const [action, updated] = updatedResponse.data
        expect(action).toBe('updated')

        // ...createdAt is unchanged
        expect(updated.createdAt).toEqual(original.data.createdAt)

        // ...expiresAt is 6 months from "now"
        expect(updated.expiresAt).toBeNearDate(addMonths(updateTime, 6))

        // ...lastUpdatedAt is unchanged
        expect(updated.lastUpdatedAt).toEqual(original.data.lastUpdatedAt)

        // ...housingReference.reviewedAt is unchanged
        expect(updated.housingReference.reviewedAt).toEqual(
          original.data.housingReference.reviewedAt
        )

        // ...housingReference.expiresAt is unchanged
        expect(updated.housingReference.expiresAt).toEqual(
          original.data.housingReference.expiresAt
        )
      }))
  })
})
