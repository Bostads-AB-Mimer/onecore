import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as replyToOffer from '../../../processes/parkingspaces/internal/reply-to-offer'
import * as offerProcess from '../../../processes/parkingspaces/internal/create-offer'

import {
  Lease,
  ConsumerReport,
  ReplyToOfferErrorCodes,
  GetActiveOfferByListingIdErrorCodes,
} from 'onecore-types'
import * as factory from '../../../../test/factories'
import { ProcessStatus } from '../../../common/types'
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  let leaseMock: Lease, consumerReportMock: ConsumerReport

  beforeEach(() => {
    leaseMock = {
      leaseId: '1',
      leaseNumber: '9433',
      leaseStartDate: new Date('2023-06-01T09:57:53.144Z'),
      leaseEndDate: new Date('2023-06-01T09:57:53.144Z'),
      status: 0,
      tenantContactIds: ['P4417', 'P5602'],
      address: undefined,
      noticeGivenBy: undefined,
      noticeDate: undefined,
      noticeTimeTenant: undefined,
      preferredMoveOutDate: undefined,
      contractDate: undefined,
      terminationDate: undefined,
      lastDebitDate: undefined,
      approvalDate: undefined,
      tenants: [
        {
          contactCode: 'P4417',
          contactKey: 'ABC',
          firstName: 'Anneli',
          lastName: 'Forsberg',
          nationalRegistrationNumber: '20740522-7848',
          birthDate: new Date('20740522'),
          address: {
            street: 'Gatvägen',
            number: '29',
            postalCode: '72489',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              isMainNumber: true,
              phoneNumber: '+465480978306',
              type: 'mobile',
            },
            {
              isMainNumber: false,
              phoneNumber: '+460777174972',
              type: 'home',
            },
          ],
          emailAddress: 'test@test.se',
          leaseIds: ['1'],
          leases: undefined,
          fullName: 'Anneli Forsberg',
          isTenant: true,
        },
        {
          contactCode: 'P5602',
          contactKey: 'ABC',
          firstName: 'Berit',
          lastName: 'Holmgren',
          nationalRegistrationNumber: '20850523-6536',
          birthDate: new Date('20850523'),
          address: {
            street: 'Gatvägen',
            number: '29',
            postalCode: '72489',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              isMainNumber: true,
              phoneNumber: '+467932495313',
              type: 'mobile',
            },
            {
              isMainNumber: false,
              phoneNumber: '+469731498801',
              type: 'home',
            },
          ],
          emailAddress: 'test@test.se',
          leaseIds: ['1'],
          leases: undefined,
          fullName: 'Berit Holmgren',
          isTenant: true,
        },
      ],
      rentalPropertyId: '264',
      rentalProperty: undefined,
      type: 'type',
      rentInfo: undefined,
    }
    consumerReportMock = {
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
  })

  describe('GET /leases/for/:pnr', () => {
    it('responds with a list of leases', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPnr')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get('/leases/for/101010-1010')
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

  describe('GET /contact/:pnr', () => {
    it('responds with a contact', async () => {
      const contact = factory.contact.build()
      const getContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(contact)

      const res = await request(app.callback()).get('/contact/194512121122')

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
      jest
        .spyOn(offerProcess, 'createOfferForInternalParkingSpace')
        .mockResolvedValue({
          processStatus: ProcessStatus.successful,
          data: null,
          httpStatus: 200,
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

  describe('GET /cas/getConsumerReport/:pnr', () => {
    it('responds with a credit information', async () => {
      const getCreditInformationSpy = jest
        .spyOn(tenantLeaseAdapter, 'getCreditInformation')
        .mockResolvedValue(consumerReportMock)

      const res = await request(app.callback()).get(
        '/cas/getConsumerReport/194512121122'
      )

      expect(res.status).toBe(200)
      expect(getCreditInformationSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(consumerReportMock)
      )
    })
  })

  describe('GET /listing/:listingId/applicants/details', () => {
    it('responds with a listing with detailed applicant data', async () => {
      const detailedApplicants = [
        factory.detailedApplicant.build(),
        factory.detailedApplicant.build(),
      ]
      const getListingByIdWithDetailedApplicantsSpy = jest
        .spyOn(tenantLeaseAdapter, 'getListingByIdWithDetailedApplicants')
        .mockResolvedValue(detailedApplicants)

      const res = await request(app.callback()).get(
        '/listing/1337/applicants/details'
      )

      expect(res.status).toBe(200)
      expect(getListingByIdWithDetailedApplicantsSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(detailedApplicants)
      )
    })
  })

  describe('GET /contact/contactCode/:contactCode', () => {
    it('returns 200 and a contact', async () => {
      const contact = factory.contact.build()
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({ ok: true, data: contact })

      const res = await request(app.callback()).get(
        `/contact/contactCode/${contact.contactCode}`
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
        `/contact/contactCode/${contact.contactCode}`
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

  describe('GET /offers/listing-id/:listingId', () => {
    it('responds with 500 if adapter fails', async () => {
      const getOffersByListingIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOffersByListingId')
        .mockResolvedValueOnce({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get(`/offers/listing-id/1`)

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

      const res = await request(app.callback()).get(`/offers/listing-id/1`)

      expect(res.status).toBe(200)
      expect(getOffersByListingIdSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({ content: expect.any(Array) })
    })
  })

  describe('GET /listing-with-applicants', () => {
    const getListingsWithApplicantsSpy = jest.spyOn(
      tenantLeaseAdapter,
      'getListingsWithApplicants'
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

  describe('GET /offers/listing-id/:listingId/active', () => {
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
        `/offers/listing-id/${1}/active`
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
        `/offers/listing-id/${1}/active`
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
        `/offers/listing-id/${1}/active`
      )

      expect(res.status).toBe(200)
      expect(getActiveOfferByListingIdSpy).toHaveBeenCalled()
      expect(res.body).toMatchObject({
        content: expect.objectContaining({ id: expect.any(Number) }),
      })
    })
  })
})
