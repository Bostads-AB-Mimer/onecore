import { HttpStatusCode } from 'axios'
import assert from 'node:assert'
import nock from 'nock'
import { leasing, WaitingListType } from '@onecore/types'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

import * as factory from '../../../../test/factories'

describe('leasing-adapter', () => {
  describe(leasingAdapter.getDetailedApplicantsByListingId, () => {
    it('should return detailed applicants by listing id', async () => {
      const detailedApplicants = factory.detailedApplicant.buildList(1)
      nock(config.tenantsLeasesService.url)
        .get(/listing/)
        .reply(200, { content: detailedApplicants })

      const result = await leasingAdapter.getDetailedApplicantsByListingId(1337)
      assert(result.ok)

      expect(result.data).toEqual([
        expect.objectContaining({ id: detailedApplicants[0].id }),
      ])
    })
  })

  describe(leasingAdapter.addApplicantToWaitingList, () => {
    it('should add applicant to waiting list', async () => {
      nock(config.tenantsLeasesService.url)
        .post(/contacts\/P123456\/waitingLists/)
        .reply(201)

      const result = await leasingAdapter.addApplicantToWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result.status).toEqual(HttpStatusCode.Created)
    })
  })

  describe(leasingAdapter.resetWaitingList, () => {
    it('should reset waiting list for applicant', async () => {
      nock(config.tenantsLeasesService.url)
        .post(/contacts\/P123456\/waitingLists/)
        .reply(200)

      const result = await leasingAdapter.resetWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result.ok).toEqual(true)
    })

    it('should return not-in-waiting-list when applicant not in waiting list', async () => {
      nock(config.tenantsLeasesService.url)
        .post(/contacts\/P123456\/waitingLists/)
        .reply(404)

      const result = await leasingAdapter.resetWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result.ok).toEqual(false)
      if (!result.ok) expect(result.err).toBe('not-in-waiting-list')
    })

    it('should return unknown on unknown error from leasing', async () => {
      nock(config.tenantsLeasesService.url)
        .post(/contacts\/P123456\/waitingLists/)
        .reply(500)

      const result = await leasingAdapter.resetWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result.ok).toEqual(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })
  })

  describe(leasingAdapter.validateResidentialAreaRentalRules, () => {
    it('calls leasing and parses a passing validation result', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/applicants\/validateResidentialAreaRentalRules/)
        .reply(200, { applicationType: 'Replace' })

      const result = await leasingAdapter.validateResidentialAreaRentalRules(
        '123',
        'ABC'
      )

      expect(result.ok).toBe(true)
    })

    it('calls leasing and returns an error', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/applicants\/validateResidentialAreaRentalRules/)
        .reply(400, { reason: 'some-reason' })

      const result = await leasingAdapter.validateResidentialAreaRentalRules(
        '123',
        'ABC'
      )

      expect(result).toMatchObject({ ok: false, err: { tag: 'unknown' } })
    })
  })

  describe(leasingAdapter.validatePropertyRentalRules, () => {
    it('calls leasing and parses a passing validation result', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/applicants\/validatePropertyRentalRules/)
        .reply(200, { applicationType: 'Replace' })

      const result = await leasingAdapter.validatePropertyRentalRules(
        '123',
        'ABC'
      )

      expect(result.ok).toBe(true)
    })

    it('calls leasing and returns an error', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/applicants\/validatePropertyRentalRules/)
        .reply(403, { reason: 'some-other-reason' })

      const result = await leasingAdapter.validatePropertyRentalRules(
        '123',
        'ABC'
      )

      expect(result).toMatchObject({
        ok: false,
        err: { tag: 'not-tenant-in-the-property' },
      })
    })
  })

  describe(leasingAdapter.getApplicationProfileByContactCode, () => {
    it('returns not found when leasing responds with 404', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/123/application-profile')
        .reply(404)

      const result =
        await leasingAdapter.getApplicationProfileByContactCode('123')

      expect(result).toEqual({ ok: false, err: 'not-found' })
    })
    it('returns unknown err when leasing responds with 500', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/123/application-profile')
        .reply(500)

      const result =
        await leasingAdapter.getApplicationProfileByContactCode('123')

      expect(result).toEqual({ ok: false, err: 'unknown' })
    })

    it('returns ok and application profile when leasing responds with 200', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/123/application-profile')
        .reply(200, { content: { id: 1 } })

      const result =
        await leasingAdapter.getApplicationProfileByContactCode('123')

      expect(result).toEqual({
        ok: true,
        data: expect.objectContaining({ id: 1 }),
      })
    })
  })

  describe(leasingAdapter.createOrUpdateApplicationProfileByContactCode, () => {
    it('returns bad params when leasing responds with 400', async () => {
      nock(config.tenantsLeasesService.url)
        .post('/contacts/123/application-profile')
        .reply(400)

      const result =
        await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
          '123',
          {
            expiresAt: new Date(),
            numAdults: 0,
            numChildren: 0,
            housingType: 'RENTAL',
            housingTypeDescription: null,
            landlord: null,
            lastUpdatedAt: new Date(),
            housingReference:
              factory.applicationProfileHousingReference.build(),
          }
        )

      expect(result).toEqual({ ok: false, err: 'bad-params' })
    })

    it('returns unknown err when leasing responds with 500', async () => {
      nock(config.tenantsLeasesService.url)
        .post('/contacts/123/application-profile')
        .reply(500)

      const result =
        await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
          '123',
          {
            expiresAt: new Date(),
            numAdults: 0,
            numChildren: 0,
            housingType: 'RENTAL',
            housingTypeDescription: null,
            landlord: null,
            lastUpdatedAt: new Date(),
            housingReference:
              factory.applicationProfileHousingReference.build(),
          }
        )

      expect(result).toEqual({ ok: false, err: 'unknown' })
    })

    it('returns ok and application profile when leasing responds with 200', async () => {
      nock(config.tenantsLeasesService.url)
        .post('/contacts/123/application-profile')
        .reply(200, {
          content: factory.applicationProfile.build(),
        })

      const result =
        await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
          '123',
          {
            expiresAt: new Date(),
            numAdults: 0,
            numChildren: 0,
            housingType: 'RENTAL',
            housingTypeDescription: null,
            landlord: null,
            lastUpdatedAt: new Date(),
            housingReference:
              factory.applicationProfileHousingReference.build(),
          }
        )

      assert(result.ok)
      expect(() =>
        leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.parse(
          result.data
        )
      ).not.toThrow()
    })
  })

  describe(leasingAdapter.getTenantByContactCode, () => {
    it('returns tenant when leasing responds with 200', async () => {
      const tenant = factory.tenant.build()
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P123456/tenant')
        .reply(200, { content: JSON.parse(JSON.stringify(tenant)) })

      const result = await leasingAdapter.getTenantByContactCode('P123456')

      assert(result.ok)
      expect(result.data.contactCode).toEqual(tenant.contactCode)
    })

    it('returns contact-not-found when leasing responds with 404 contact-not-found', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P123456/tenant')
        .reply(404, { type: 'contact-not-found' })

      const result = await leasingAdapter.getTenantByContactCode('P123456')

      expect(result).toEqual({ ok: false, err: 'contact-not-found' })
    })

    it('returns contact-not-tenant when leasing responds with 404 contact-not-tenant', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P123456/tenant')
        .reply(404, { type: 'contact-not-tenant' })

      const result = await leasingAdapter.getTenantByContactCode('P123456')

      expect(result).toEqual({ ok: false, err: 'contact-not-tenant' })
    })

    it('returns contact-not-tenant when leasing responds with 404 contact-leases-not-found', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P123456/tenant')
        .reply(404, { type: 'contact-leases-not-found' })

      const result = await leasingAdapter.getTenantByContactCode('P123456')

      expect(result).toEqual({ ok: false, err: 'contact-not-tenant' })
    })

    it('returns no-valid-housing-contract when leasing responds with 404 no-valid-housing-contract', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P123456/tenant')
        .reply(404, { type: 'no-valid-housing-contract' })

      const result = await leasingAdapter.getTenantByContactCode('P123456')

      expect(result).toEqual({ ok: false, err: 'no-valid-housing-contract' })
    })

    it('returns err from response body type when leasing responds with 500', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P123456/tenant')
        .reply(500, { type: 'get-contact' })

      const result = await leasingAdapter.getTenantByContactCode('P123456')

      expect(result).toEqual({ ok: false, err: 'get-contact' })
    })
  })
})
