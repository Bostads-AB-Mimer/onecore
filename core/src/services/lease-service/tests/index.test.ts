import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import {
  Lease,
  ConsumerReport,
  ReplyToOfferErrorCodes,
  GetActiveOfferByListingIdErrorCodes,
  ListingStatus,
  UpdateListingStatusErrorCodes,
} from '@onecore/types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import * as replyToOffer from '../../../processes/parkingspaces/internal/reply-to-offer'

import * as factory from '../../../../test/factories'
import { ProcessStatus } from '../../../common/types'
import { schemas } from '../schemas'
import { Lease as LeaseSchema } from '../schemas/lease'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('lease-service', () => {
  const leaseMock: Lease = factory.lease.build()
  const consumerReportMock: ConsumerReport = {
    pnr: '4512121122',
    template: 'TEST_TEMPLATE',
    status: '2',
    status_text: 'Ej Godkänd',
    errorList: [
      {
        Cause_of_Reject: 'P24',
        Reject_comment: '',
        Reject_text: 'Scoring',
      },
    ],
    name: 'Erik Lundberg',
    address: 'Gatvägen 56',
    zip: '72266',
    city: 'Västerås',
  }

  describe('GET /leases/by-rental-property-id/:rentalPropertyId', () => {
    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-rental-property-id/123?includeUpcomingLeases=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockRejectedValue(new Error('Adapter error'))

      const res = await request(app.callback()).get(
        '/leases/by-rental-property-id/123'
      )

      expect(res.status).toBe(500)
    })

    it('responds with a list of leases for valid query parameters', async () => {
      const getLeasesForPropertyIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockResolvedValue(factory.lease.buildList(1))

      const res = await request(app.callback()).get(
        '/leases/by-rental-property-id/123?includeUpcomingLeases=true&includeTerminatedLeases=false&includeContacts=true'
      )

      expect(res.status).toBe(200)
      expect(getLeasesForPropertyIdSpy).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          includeUpcomingLeases: true,
          includeTerminatedLeases: false,
          includeContacts: true,
        })
      )

      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /leases/by-pnr/:pnr', () => {
    it('responds with a list of leases', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPnr')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/leases/by-pnr/101010-1010'
      )
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()
      expect(res.body.content).toBeInstanceOf(Array)
      expect(JSON.stringify(res.body.content[0])).toEqual(
        JSON.stringify(leaseMock)
      )
    })
  })

  describe('GET /leases/:id', () => {
    it('responds with lease', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const res = await request(app.callback()).get('/leases/1337')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(leaseMock)
      )
    })
  })

  describe('POST /leases/by-lease-id/:leaseId/preliminary-termination', () => {
    const validRequestBody = {
      contactCode: 'P12345',
      lastDebitDate: '2025-12-31T00:00:00.000Z',
      desiredMoveDate: '2025-12-31T00:00:00.000Z',
    }

    it('should return 404 if tenant is not found', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'preliminaryTerminateLease')
        .mockResolvedValue({
          ok: false,
          err: 'tenant-not-found',
        })

      const res = await request(app.callback())
        .post(
          '/leases/by-lease-id/216-704-00-0022%2F02/preliminary-termination'
        )
        .send(validRequestBody)

      expect(res.status).toBe(404)
      expect(res.body.message).toBe('Tenant not found')
    })

    it('should return 404 if lease is not found', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'preliminaryTerminateLease')
        .mockResolvedValue({
          ok: false,
          err: 'lease-not-found',
        })

      const res = await request(app.callback())
        .post(
          '/leases/by-lease-id/216-704-00-0022%2F02/preliminary-termination'
        )
        .send(validRequestBody)

      expect(res.status).toBe(404)
      expect(res.body.message).toBe('Lease not found')
    })

    it('should return 500 if termination fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'preliminaryTerminateLease')
        .mockResolvedValue({
          ok: false,
          err: 'termination-failed',
        })

      const res = await request(app.callback())
        .post(
          '/leases/by-lease-id/216-704-00-0022%2F02/preliminary-termination'
        )
        .send(validRequestBody)

      expect(res.status).toBe(500)
      expect(res.body.message).toBe('Failed to preliminary terminate lease')
    })

    it('should return 500 for unknown errors', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'preliminaryTerminateLease')
        .mockResolvedValue({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback())
        .post(
          '/leases/by-lease-id/216-704-00-0022%2F02/preliminary-termination'
        )
        .send(validRequestBody)

      expect(res.status).toBe(500)
      expect(res.body.message).toBe('Failed to preliminary terminate lease')
    })

    it('should return 200 and success message when termination succeeds', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'preliminaryTerminateLease')
        .mockResolvedValue({
          ok: true,
          data: {
            content: { message: 'Signerings begäran skickad' },
            message: 'Preliminary termination initiated successfully',
          },
        })

      const res = await request(app.callback())
        .post(
          '/leases/by-lease-id/216-704-00-0022%2F02/preliminary-termination'
        )
        .send(validRequestBody)

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        content: { message: 'Signerings begäran skickad' },
        message: 'Preliminary termination initiated successfully',
      })
      expect(res.body.message).toBe('Preliminary termination request received')
    })

    it('should handle leaseId with special characters', async () => {
      const preliminaryTerminateSpy = jest
        .spyOn(tenantLeaseAdapter, 'preliminaryTerminateLease')
        .mockResolvedValue({
          ok: true,
          data: {
            content: { message: 'Signerings begäran skickad' },
            message: 'Preliminary termination initiated successfully',
          },
        })

      await request(app.callback())
        .post(
          '/leases/by-lease-id/216-704-00-0022%2F02/preliminary-termination'
        )
        .send(validRequestBody)

      expect(preliminaryTerminateSpy).toHaveBeenCalledWith(
        '216-704-00-0022/02',
        'P12345',
        new Date('2025-12-31T00:00:00.000Z'),
        new Date('2025-12-31T00:00:00.000Z')
      )
    })
  })

  describe('GET /contacts/by-pnr/:pnr', () => {
    it('responds with a contact', async () => {
      const contact = factory.contact.build()
      const getContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(contact)

      const res = await request(app.callback()).get(
        '/contacts/by-pnr/194512121122'
      )

      expect(res.status).toBe(200)
      expect(getContactSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(JSON.stringify(contact))
    })
  })

  describe('GET /contacts/:contactCode/offers', () => {
    it('responds with offers', async () => {
      const detailedApplicant1 = factory.detailedApplicant.build({
        contactCode: 'P174965',
      })
      const offer1 = factory.offerWithRentalObjectCode.build({
        offeredApplicant: detailedApplicant1,
      })

      const offer2 = factory.offerWithRentalObjectCode.build({
        offeredApplicant: detailedApplicant1,
      })

      const offers = [offer1, offer2]

      const getOffersForContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOffersForContact')
        .mockResolvedValueOnce({ ok: true, data: offers })

      const res = await request(app.callback()).get('/contacts/P174965/offers')

      expect(res.status).toBe(200)
      expect(getOffersForContactSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(JSON.stringify(offers))
    })
  })

  describe('GET /offers/:offerId/applicants/:contactCode', () => {
    it('responds with an offer', async () => {
      const detailedApplicant = factory.detailedApplicant.build({
        contactCode: 'P174965',
      })

      const offer = factory.detailedOffer.build({
        offeredApplicant: detailedApplicant,
      })

      const getOffersForContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOfferByContactCodeAndOfferId')
        .mockResolvedValueOnce({ ok: true, data: offer })

      const res = await request(app.callback()).get(
        `/offers/${offer.id}/applicants/${detailedApplicant.contactCode}`
      )

      expect(res.status).toBe(200)
      expect(getOffersForContactSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(JSON.stringify(offer))
    })
    it('returns 404 if no offer', async () => {
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOfferByContactCodeAndOfferId')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/offers/NON_EXISTING_OFFER/applicants/NON_EXISTING_APPLICANT`
      )

      expect(res.status).toBe(404)
      expect(getContactByContactCodeSpy).toHaveBeenCalled()
    })
  })

  describe('POST /offers/:offerId/accept', () => {
    it('responds with successful processStatus', async () => {
      jest.spyOn(replyToOffer, 'acceptOffer').mockResolvedValue({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })

      const result = await request(app.callback()).post('/offers/123/accept')

      expect(result.status).toBe(202)
      expect(result.body.message).toBe('Offer accepted successfully')
    })
    it('accept offer returns 500 on error', async () => {
      jest.spyOn(replyToOffer, 'acceptOffer').mockResolvedValue({
        processStatus: ProcessStatus.failed,
        httpStatus: 404,
        error: ReplyToOfferErrorCodes.NoOffer,
      })

      const result = await request(app.callback()).post('/offers/123/accept')

      expect(result.status).toBe(404)
      expect(result.body.error).toBe('no-offer')
    })
  })

  describe('POST /offers/:offerId/deny', () => {
    it('responds with successful processStatus', async () => {
      jest.spyOn(replyToOffer, 'denyOffer').mockResolvedValueOnce({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: { listingId: 123 },
      })

      const result = await request(app.callback()).post('/offers/123/deny')

      expect(result.status).toBe(202)
      expect(result.body.message).toBe('Offer denied successfully')
    })

    it('deny offer returns 500 on error', async () => {
      jest.spyOn(replyToOffer, 'denyOffer').mockResolvedValue({
        processStatus: ProcessStatus.failed,
        httpStatus: 404,
        error: ReplyToOfferErrorCodes.NoOffer,
      })

      const result = await request(app.callback()).post('/offers/123/deny')

      expect(result.status).toBe(404)
      expect(result.body.error).toBe('no-offer')
    })
  })

  describe('GET /offers/:offerId/expire', () => {
    it('responds with successful processStatus', async () => {
      jest.spyOn(replyToOffer, 'expireOffer').mockResolvedValueOnce({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })

      const result = await request(app.callback()).get('/offers/123/expire')

      expect(result.status).toBe(202)
      expect(result.body.message).toBe('Offer expired successfully')
    })
    it('expire offer returns 500 on error', async () => {
      jest.spyOn(replyToOffer, 'expireOffer').mockResolvedValue({
        processStatus: ProcessStatus.failed,
        httpStatus: 404,
        error: ReplyToOfferErrorCodes.NoOffer,
      })

      const result = await request(app.callback()).get('/offers/123/expire')

      expect(result.status).toBe(500)
      expect(result.body.error).toBe('no-offer')
    })
  })

  describe('GET /consumer-reports/by-pnr/:pnr', () => {
    it('responds with a credit information', async () => {
      const getCreditInformationSpy = jest
        .spyOn(tenantLeaseAdapter, 'getCreditInformation')
        .mockResolvedValue(consumerReportMock)

      const res = await request(app.callback()).get(
        '/consumer-reports/by-pnr/194512121122'
      )

      expect(res.status).toBe(200)
      expect(getCreditInformationSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(consumerReportMock)
      )
    })
  })

  describe('GET /listings/:listingId/applicants/details', () => {
    it('responds with a listing with detailed applicant data', async () => {
      const detailedApplicants = [
        factory.detailedApplicant.build(),
        factory.detailedApplicant.build(),
      ]
      const getListingByIdWithDetailedApplicantsSpy = jest
        .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
        .mockResolvedValue({ ok: true, data: detailedApplicants })

      const res = await request(app.callback()).get(
        '/listings/1337/applicants/details'
      )

      expect(res.status).toBe(200)
      expect(getListingByIdWithDetailedApplicantsSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(detailedApplicants)
      )
    })
  })

  describe('GET /contacts/:contactCode', () => {
    it('returns 200 and a contact', async () => {
      const contact = factory.contact.build()
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({ ok: true, data: contact })

      const res = await request(app.callback()).get(
        `/contacts/${contact.contactCode}`
      )

      expect(res.status).toBe(200)
      expect(getContactByContactCodeSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(JSON.stringify(contact))
    })

    it('returns 404 if no contact', async () => {
      const contact = factory.contact.build()
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/contacts/${contact.contactCode}`
      )

      expect(res.status).toBe(404)
      expect(getContactByContactCodeSpy).toHaveBeenCalled()
    })
  })

  describe('GET /contacts/search', () => {
    it('returns 400 if missing query param', async () => {
      const res = await request(app.callback()).get(`/contacts/search`)

      expect(res.status).toBe(400)
    })

    it('returns 200 and a list of contact data', async () => {
      const contacts = factory.contact
        .buildList(1)
        .map(({ fullName, contactCode }) => ({ fullName, contactCode }))

      const getContactsDataBySearchQuery = jest
        .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
        .mockResolvedValueOnce({
          ok: true,
          data: contacts,
        })

      const res = await request(app.callback()).get(`/contacts/search?q=foo`)

      expect(res.status).toBe(200)
      expect(getContactsDataBySearchQuery).toHaveBeenCalled()
      expect(res.body.content).toEqual(contacts)
    })
  })

  describe('GET /offers/by-listing-id/:listingId', () => {
    it('responds with 500 if adapter fails', async () => {
      const getOffersByListingIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOffersByListingId')
        .mockResolvedValueOnce({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get(`/offers/by-listing-id/1`)

      expect(res.status).toBe(500)
      expect(getOffersByListingIdSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({ error: expect.any(String) })
    })

    it('returns a list of offers', async () => {
      const getOffersByListingIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOffersByListingId')
        .mockResolvedValueOnce({
          ok: true,
          data: [],
        })

      const res = await request(app.callback()).get(`/offers/by-listing-id/1`)

      expect(res.status).toBe(200)
      expect(getOffersByListingIdSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({ content: expect.any(Array) })
    })
  })

  describe('GET /listings-with-applicants', () => {
    const getListingsWithApplicantsSpy = jest.spyOn(
      tenantLeaseAdapter,
      'getListingsWithApplicants'
    )

    const getParkingSpacesSpy = jest.spyOn(
      tenantLeaseAdapter,
      'getParkingSpaces'
    )

    beforeEach(jest.resetAllMocks)
    it('responds with 500 if adapter fails', async () => {
      getListingsWithApplicantsSpy.mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get(`/listings-with-applicants`)

      expect(res.status).toBe(500)
      expect(getListingsWithApplicantsSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({ error: expect.any(String) })
    })

    it('responds with 200 and listings', async () => {
      getListingsWithApplicantsSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      getParkingSpacesSpy.mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get(`/listings-with-applicants`)

      expect(res.status).toBe(200)
      expect(getListingsWithApplicantsSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({ content: expect.any(Array) })
    })

    it('passes along query params', async () => {
      getListingsWithApplicantsSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      getParkingSpacesSpy.mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get(
        `/listings-with-applicants?type=published`
      )

      expect(res.status).toBe(200)
      expect(getListingsWithApplicantsSpy).toHaveBeenCalledWith(
        'type=published'
      )
      expect(res.body).toMatchObject({ content: expect.any(Array) })
    })
  })

  describe('GET /offers/by-listing-id/:listingId/active', () => {
    const getActiveOfferByListingIdSpy = jest.spyOn(
      tenantLeaseAdapter,
      'getActiveOfferByListingId'
    )

    beforeEach(jest.resetAllMocks)
    it('responds with 500 if adapter fails', async () => {
      getActiveOfferByListingIdSpy.mockResolvedValueOnce({
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.Unknown,
      })

      const res = await request(app.callback()).get(
        `/offers/by-listing-id/${1}/active`
      )

      expect(res.status).toBe(500)
      expect(getActiveOfferByListingIdSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({ error: expect.any(String) })
    })

    it('responds with 404 if not found', async () => {
      getActiveOfferByListingIdSpy.mockResolvedValueOnce({
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.NotFound,
      })

      const res = await request(app.callback()).get(
        `/offers/by-listing-id/${1}/active`
      )

      expect(res.status).toBe(404)
      expect(getActiveOfferByListingIdSpy).toHaveBeenCalled()
    })

    it('responds with 200 and listings', async () => {
      getActiveOfferByListingIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.offer.build(),
      })

      const res = await request(app.callback()).get(
        `/offers/by-listing-id/${1}/active`
      )

      expect(res.status).toBe(200)
      expect(getActiveOfferByListingIdSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({
        content: expect.objectContaining({ id: expect.any(Number) }),
      })
    })
  })

  describe('GET /contacts/:contactCode/application-profile', () => {
    it('responds with 404 if not found', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/contacts/1234/application-profile'
      )

      expect(res.status).toBe(404)
      expect(res.body).toEqual({
        error: 'not-found',
      })
    })

    it('responds with 200 and application profile', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const res = await request(app.callback()).get(
        '/contacts/1234/application-profile'
      )

      expect(res.status).toBe(200)
      expect(() =>
        schemas.client.applicationProfile.GetApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()
    })
  })

  describe('POST /contacts/:contactCode/application-profile/admin', () => {
    beforeEach(jest.resetAllMocks)
    it('responds with 400 if bad params', async () => {
      const res = await request(app.callback()).post(
        '/contacts/1234/application-profile/admin'
      )

      expect(res.status).toBe(400)
    })

    it('responds with 200 and application profile', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      jest
        .spyOn(
          tenantLeaseAdapter,
          'createOrUpdateApplicationProfileByContactCode'
        )
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const res = await request(app.callback())
        .post('/contacts/1234/application-profile/admin')
        .send(factory.applicationProfile.build())

      expect(res.status).toBe(200)
      expect(() =>
        schemas.admin.applicationProfile.UpdateApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()
    })

    it('when profile information is updated, application profile lastUpdatedAt and expiresAt are updated', async () => {
      const existingProfile = factory.applicationProfile.build({
        numAdults: 2,
        lastUpdatedAt: new Date('2021-01-01'),
        expiresAt: new Date('2021-01-01'),
      })

      const updatedProfile = factory.applicationProfile.build({
        ...existingProfile,
        numAdults: 3,
      })

      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const adapterSpy = jest
        .spyOn(
          tenantLeaseAdapter,
          'createOrUpdateApplicationProfileByContactCode'
        )
        .mockResolvedValueOnce({
          ok: true,
          data: existingProfile,
        })

      const res = await request(app.callback())
        .post(
          `/contacts/${existingProfile.contactCode}/application-profile/admin`
        )
        .send(updatedProfile)

      expect(res.status).toBe(200)
      expect(() =>
        schemas.admin.applicationProfile.UpdateApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()

      const [[, updateParams]] = adapterSpy.mock.calls
      expect(updateParams.lastUpdatedAt?.getTime()).toBeGreaterThan(
        existingProfile.lastUpdatedAt?.getTime() as number
      )

      expect(updateParams.expiresAt?.getTime()).toBeGreaterThan(
        existingProfile.expiresAt?.getTime() as number
      )
    })

    it('when reviewed, application profile housing reference reviewedAt and expiresAt are updated', async () => {
      const existingProfile = factory.applicationProfile.build({
        numAdults: 2,
        lastUpdatedAt: new Date('2021-01-01'),
        expiresAt: new Date('2021-01-01'),
        housingReference: {
          reviewedAt: new Date('2021-01-01'),
          expiresAt: new Date('2021-01-01'),
          reviewStatus: 'PENDING',
        },
      })

      const updatedProfile = factory.applicationProfile.build({
        ...existingProfile,
        housingReference: {
          ...existingProfile.housingReference,
          reviewStatus: 'REJECTED',
          expiresAt: new Date('2022-01-01'),
        },
      })

      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: existingProfile,
        })

      const adapterSpy = jest
        .spyOn(
          tenantLeaseAdapter,
          'createOrUpdateApplicationProfileByContactCode'
        )
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const res = await request(app.callback())
        .post(
          `/contacts/${existingProfile.contactCode}/application-profile/admin`
        )
        .send(updatedProfile)

      expect(res.status).toBe(200)
      expect(() =>
        schemas.admin.applicationProfile.UpdateApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()

      const [[, updateParams]] = adapterSpy.mock.calls
      expect(
        updateParams.housingReference.reviewedAt?.getTime()
      ).toBeGreaterThan(
        existingProfile.housingReference.reviewedAt?.getTime() as number
      )

      expect(
        updateParams.housingReference.expiresAt?.getTime()
      ).toBeGreaterThan(
        existingProfile.housingReference.expiresAt?.getTime() as number
      )
    })

    it('allows update with null housingType on existing profile', async () => {
      const existingProfile = factory.applicationProfile.build({
        housingType: null,
        numAdults: 2,
        lastUpdatedAt: new Date('2021-01-01'),
        expiresAt: new Date('2021-01-01'),
        housingReference: {
          reviewedAt: new Date('2021-01-01'),
          expiresAt: new Date('2021-01-01'),
          reviewStatus: 'PENDING',
        },
      })

      const updatedProfile = factory.applicationProfile.build({
        ...existingProfile,
        housingType: 'RENTAL',
        housingReference: {
          ...existingProfile.housingReference,
          reviewStatus: 'REJECTED',
          expiresAt: new Date('2022-01-01'),
        },
      })

      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: existingProfile,
        })

      const adapterSpy = jest
        .spyOn(
          tenantLeaseAdapter,
          'createOrUpdateApplicationProfileByContactCode'
        )
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const res = await request(app.callback())
        .post(
          `/contacts/${existingProfile.contactCode}/application-profile/admin`
        )
        .send(updatedProfile)

      expect(res.status).toBe(200)
      expect(() =>
        schemas.admin.applicationProfile.UpdateApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()

      expect(adapterSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ housingType: updatedProfile.housingType })
      )
    })
  })

  describe('POST /contacts/:contactCode/application-profile/client', () => {
    beforeEach(jest.resetAllMocks)
    it('responds with 400 if bad params', async () => {
      const res = await request(app.callback()).post(
        '/contacts/1234/application-profile/client'
      )

      expect(res.status).toBe(400)
    })

    it('responds with 200 and application profile', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      jest
        .spyOn(
          tenantLeaseAdapter,
          'createOrUpdateApplicationProfileByContactCode'
        )
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const res = await request(app.callback())
        .post('/contacts/1234/application-profile/client')
        .send({
          numAdults: 0,
          numChildren: 0,
          housingType: 'RENTAL',
          housingTypeDescription: 'bar',
          landlord: null,
          housingReference: {
            email: null,
            phone: null,
            comment: null,
          },
        })

      expect(res.status).toBe(200)
      expect(() =>
        schemas.client.applicationProfile.UpdateApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()
    })

    it('when profile updates, updates lastUpdatedAt and expiresAt', async () => {
      const existingProfile = factory.applicationProfile.build({
        numAdults: 2,
        lastUpdatedAt: new Date('2021-01-01'),
        expiresAt: new Date('2021-01-01'),
      })

      jest
        .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: existingProfile,
        })

      const adapterSpy = jest
        .spyOn(
          tenantLeaseAdapter,
          'createOrUpdateApplicationProfileByContactCode'
        )
        .mockResolvedValueOnce({
          ok: true,
          data: factory.applicationProfile.build(),
        })

      const res = await request(app.callback())
        .post('/contacts/1234/application-profile/client')
        .send({
          numAdults: 0,
          numChildren: 0,
          housingType: 'RENTAL',
          housingTypeDescription: 'bar',
          landlord: null,
          housingReference: {
            email: null,
            phone: null,
            comment: null,
          },
        })

      expect(res.status).toBe(200)
      expect(() =>
        schemas.client.applicationProfile.UpdateApplicationProfileResponseData.parse(
          res.body.content
        )
      ).not.toThrow()

      const [[, updateParams]] = adapterSpy.mock.calls
      expect(updateParams.lastUpdatedAt?.getTime()).toBeGreaterThan(
        existingProfile.lastUpdatedAt?.getTime() as number
      )

      expect(updateParams.expiresAt?.getTime()).toBeGreaterThan(
        existingProfile.expiresAt?.getTime() as number
      )
    })
  })
})

describe('GET /contacts/:contactCode/:rentalObjectCode/verify-application', () => {
  it('responds with 404 if application profile was not found', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get(
      '/contacts/contact-code/rental-object-code/verify-application'
    )

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      reason: 'Application profile not found',
    })
  })

  it('responds with 404 if apartment rental property info was not found', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.applicationProfile.build(),
      })

    jest
      .spyOn(propertyManagementAdapter, 'getApartmentRentalPropertyInfo')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get(
      '/contacts/contact-code/rental-object-code/verify-application'
    )

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      reason: 'Rental property info not found',
    })
  })

  it('responds with 403 if application not allowed', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.applicationProfile.build({
          numAdults: 3,
          numChildren: 3,
        }),
      })

    jest
      .spyOn(propertyManagementAdapter, 'getApartmentRentalPropertyInfo')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.apartmentInfo.build({ roomTypeCode: '1RK' }),
      })

    const res = await request(app.callback()).get(
      '/contacts/contact-code/rental-object-code/verify-application'
    )

    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      reason: 'Too many residents for this rental property',
    })
  })

  it('responds with 200 if application allowed', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getApplicationProfileByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.applicationProfile.build(),
      })

    jest
      .spyOn(propertyManagementAdapter, 'getApartmentRentalPropertyInfo')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.apartmentInfo.build({ roomTypeCode: '2RK' }),
      })

    const res = await request(app.callback()).get(
      '/contacts/contact-code/rental-object-code/verify-application'
    )

    expect(res.status).toBe(200)
  })
})
