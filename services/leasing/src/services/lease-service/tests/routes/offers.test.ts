import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { OfferStatus } from '@onecore/types'

import { routes } from '../../routes/offers'
import * as offerAdapter from '../../adapters/offer-adapter'
import * as factory from '../factories'
import * as offerService from '../../offer-service'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.restoreAllMocks)
describe('offers', () => {
  describe('POST /offer', () => {
    it('responds with 400 if request params are missing', async () => {
      const res = await request(app.callback()).post('/offer')
      expect(res.status).toBe(400)
    })

    it('responds with 400 if request params are invalid', async () => {
      const payload = {
        status: 'foo',
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [factory.offerApplicant.build({ applicantId: 1 })],
        expiresAt: new Date().toISOString(),
      }

      const res = await request(app.callback()).post('/offer').send(payload)
      expect(res.status).toBe(400)
      expect(res.body.data).toEqual([
        {
          message: 'Invalid option: expected one of 1|2|3|4',
          path: ['status'],
        },
      ])
    })

    it('creates an offer', async () => {
      const tempOffer = factory.offer.build()
      const offer = { ...tempOffer, selectedApplicants: [] }

      jest
        .spyOn(offerAdapter, 'getOffersWithOfferApplicantsByListingId')
        .mockResolvedValueOnce({ ok: true, data: [] })
      jest
        .spyOn(offerAdapter, 'create')
        .mockResolvedValueOnce({ ok: true, data: offer })

      const payload = {
        status: OfferStatus.Active,
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [factory.offerApplicant.build({ applicantId: 1 })],
        expiresAt: new Date().toISOString(),
      }

      const res = await request(app.callback()).post('/offer').send(payload)
      const expected = {
        ...offer,
        expiresAt: offer.expiresAt.toISOString(),
        createdAt: offer.createdAt.toISOString(),
      }

      expect(res.status).toBe(201)
      expect(res.body.content.createdAt).toBeDefined()
      expect(res.body.content.listingId).toEqual(expected.listingId)
      expect(res.body.content.expiresAt).toEqual(expected.expiresAt)
    })

    it('returns error if offer is still active', async () => {
      const tempOffer = factory.offer.build()
      const offer = { ...tempOffer, selectedApplicants: [] }
      jest
        .spyOn(offerAdapter, 'getOffersWithOfferApplicantsByListingId')
        .mockResolvedValueOnce({ ok: true, data: [offer] })
      jest
        .spyOn(offerAdapter, 'create')
        .mockResolvedValueOnce({ ok: true, data: offer })

      const payloadSubsequentOffer = {
        status: OfferStatus.Active,
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [factory.offerApplicant.build({ applicantId: 1 })],
        expiresAt: new Date().toISOString(),
      }
      const resSubsequentOffer = await request(app.callback())
        .post('/offer')
        .send(payloadSubsequentOffer)
      expect(resSubsequentOffer.status).toBe(409)
      expect(resSubsequentOffer.body.reason).toBe(
        'Cannot create new offer when an active offer exists'
      )
    })

    it('creates subsequent offer if existing offer is not active', async () => {
      const tempOffer = factory.offer.build({ status: OfferStatus.Declined })
      const offer = { ...tempOffer, selectedApplicants: [] }
      jest
        .spyOn(offerAdapter, 'getOffersWithOfferApplicantsByListingId')
        .mockResolvedValueOnce({ ok: true, data: [offer] })
      jest
        .spyOn(offerAdapter, 'create')
        .mockResolvedValueOnce({ ok: true, data: offer })

      const payloadSubsequentOffer = {
        status: OfferStatus.Active,
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [factory.offerApplicant.build({ applicantId: 1 })],
        expiresAt: new Date().toISOString(),
      }
      const resSubsequentOffer = await request(app.callback())
        .post('/offer')
        .send(payloadSubsequentOffer)
      expect(resSubsequentOffer.status).toBe(201)
    })
  })

  describe('GET /contacts/:contactCode/offers', () => {
    it('responds with 404 if offers not found for contact code', async () => {
      jest.spyOn(offerAdapter, 'getOffersForContact').mockResolvedValueOnce([])
      const res = await request(app.callback()).get(
        '/contacts/NON_EXISTING_CONTACT_CODE/offers'
      )
      expect(res.status).toBe(404)
      expect(res.body.content).toBeUndefined()
    })

    it('responds with 200 on success', async () => {
      const applicant = factory.detailedApplicant.build()
      const offer = factory.offerWithRentalObjectCode.build({
        offeredApplicant: applicant,
      })

      jest
        .spyOn(offerAdapter, 'getOffersForContact')
        .mockResolvedValueOnce([offer])
      const res = await request(app.callback()).get(
        `/contacts/${applicant.contactCode}/offers`
      )
      expect(res.status).toBe(200)
      expect(res.body.content.length).toBe(1)
      expect(res.body.content[0].id).toEqual(offer.id)
      expect(res.body.content[0].listingId).toEqual(offer.listingId)
      expect(res.body.content[0].offeredApplicant.contactCode).toEqual(
        offer.offeredApplicant.contactCode
      )
    })
  })

  describe('GET /offers/:offerId/applicants/:contactCode', () => {
    it('responds with 404 if offer not found', async () => {
      jest
        .spyOn(offerAdapter, 'getOfferByContactCodeAndOfferId')
        .mockResolvedValueOnce(undefined)
      const res = await request(app.callback()).get(
        '/offers/NON_EXISTING_OFFER/applicants/NON_EXISTING_CONTACT_CODE'
      )
      expect(res.status).toBe(404)
      expect(res.body.data).toBeUndefined()
    })

    it('responds with 200 on success', async () => {
      const applicant = factory.detailedApplicant.build()
      const offer = factory.detailedOffer.build({
        offeredApplicant: applicant,
      })

      jest
        .spyOn(offerAdapter, 'getOfferByContactCodeAndOfferId')
        .mockResolvedValueOnce(offer)
      const res = await request(app.callback()).get(
        `/offers/${offer.id}/applicants/${applicant.contactCode}/`
      )
      expect(res.status).toBe(200)
      expect(res.body.content).toBeDefined()
      expect(res.body.content.id).toEqual(offer.id)
      expect(res.body.content.listingId).toEqual(offer.listingId)
      expect(res.body.content.offeredApplicant.contactCode).toEqual(
        offer.offeredApplicant.contactCode
      )
    })

    describe('GET /offers/:offerId', () => {
      it('should return an offer in the correct format', async () => {
        const applicant = factory.detailedApplicant.build()
        const offer = factory.detailedOffer.build({
          offeredApplicant: applicant,
        })

        jest
          .spyOn(offerAdapter, 'getOfferByOfferId')
          .mockResolvedValueOnce({ ok: true, data: offer })

        const res = await request(app.callback()).get(`/offers/${offer.id}`)

        expect(res.status).toBe(200)
        expect(res.body.content).toBeDefined()
        expect(res.body.content.id).toEqual(offer.id)
        expect(res.body.content.listingId).toEqual(offer.listingId)
        expect(res.body.content.offeredApplicant.contactCode).toEqual(
          offer.offeredApplicant.contactCode
        )
      })

      it('should return an error if not found', async () => {
        jest
          .spyOn(offerAdapter, 'getOfferByOfferId')
          .mockResolvedValueOnce({ ok: false, err: 'not-found' })

        const res = await request(app.callback()).get(`/offers/123`)

        expect(res.status).toBe(404)
        expect(res.body.data).toBeUndefined()
      })
    })
  })

  describe('PUT /offers/:offerId/close-by-accept', () => {
    it('responds with 404 if offer not found', async () => {
      const getOfferSpy = jest
        .spyOn(offerAdapter, 'getOfferByOfferId')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      const res = await request(app.callback()).put(
        '/offers/NON_EXISTING_OFFER/close-by-accept'
      )

      expect(res.status).toBe(404)
      expect(getOfferSpy).toHaveBeenCalledTimes(1)
      expect(res.body.data).toBeUndefined()
    })

    it('responds with 500 if error when updating', async () => {
      const getOfferSpy = jest
        .spyOn(offerAdapter, 'getOfferByOfferId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.detailedOffer.build(),
        })

      const acceptOfferSpy = jest
        .spyOn(offerService, 'acceptOffer')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).put('/offers/1/close-by-accept')

      expect(getOfferSpy).toHaveBeenCalledTimes(1)
      expect(acceptOfferSpy).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(500)
    })

    it('responds with 200 if successful', async () => {
      const getOfferSpy = jest
        .spyOn(offerAdapter, 'getOfferByOfferId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.detailedOffer.build(),
        })

      const acceptOfferSpy = jest
        .spyOn(offerService, 'acceptOffer')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback()).put('/offers/1/close-by-accept')

      expect(getOfferSpy).toHaveBeenCalledTimes(1)
      expect(acceptOfferSpy).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(200)
    })
  })

  describe('PUT /offers/:offerId/deny', () => {
    it('responds with 404 if offer not found', async () => {
      const getOfferSpy = jest
        .spyOn(offerAdapter, 'getOfferByOfferId')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      const res = await request(app.callback()).put(
        '/offers/NON_EXISTING_OFFER/deny'
      )

      expect(res.status).toBe(404)
      expect(getOfferSpy).toHaveBeenCalledTimes(1)
      expect(res.body.data).toBeUndefined()
    })

    it('responds with 500 if error when updating', async () => {
      const getOfferSpy = jest
        .spyOn(offerAdapter, 'getOfferByOfferId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.detailedOffer.build(),
        })

      const acceptOfferSpy = jest
        .spyOn(offerService, 'denyOffer')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).put('/offers/1/deny')

      expect(getOfferSpy).toHaveBeenCalledTimes(1)
      expect(acceptOfferSpy).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(500)
    })

    it('responds with 200 if successful', async () => {
      const getOfferSpy = jest
        .spyOn(offerAdapter, 'getOfferByOfferId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.detailedOffer.build(),
        })

      const acceptOfferSpy = jest
        .spyOn(offerService, 'denyOffer')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback()).put('/offers/1/deny')

      expect(getOfferSpy).toHaveBeenCalledTimes(1)
      expect(acceptOfferSpy).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(200)
    })
  })

  describe('GET /offers/listing-id/:listingId', () => {
    it('should return a list of offers', async () => {
      const tempOffer = factory.offer.build({ status: OfferStatus.Declined })
      const offer = { ...tempOffer, selectedApplicants: [] }

      jest
        .spyOn(offerAdapter, 'getOffersWithOfferApplicantsByListingId')
        .mockResolvedValueOnce({ ok: true, data: [offer] })

      const res = await request(app.callback()).get(`/offers/listing-id/1`)

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(Number) }),
        ]),
      })
    })

    it('should respond with an error if get offers fails', async () => {
      jest
        .spyOn(offerAdapter, 'getOffersWithOfferApplicantsByListingId')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(`/offers/listing-id/1`)

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: expect.any(String) })
    })
  })

  describe('GET /offers/listing-id/:listingId/active', () => {
    it('responds with 404 if not found', async () => {
      jest
        .spyOn(offerAdapter, 'getActiveOfferByListingId')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback()).get(
        `/offers/listing-id/1/active`
      )

      expect(res.status).toBe(404)
    })
  })

  it('returns an active offer', async () => {
    const tempOffer = factory.offer.build({ status: OfferStatus.Declined })
    const offer = { ...tempOffer, selectedApplicants: [] }

    jest
      .spyOn(offerAdapter, 'getActiveOfferByListingId')
      .mockResolvedValueOnce({ ok: true, data: offer })

    const res = await request(app.callback()).get(`/offers/listing-id/1/active`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      content: expect.objectContaining({ id: expect.any(Number) }),
    })
  })

  describe('PUT /offers/:offerId/sent-at', () => {
    it('responds with 400 if missing request params', async () => {
      const res = await request(app.callback()).put(`/offers/1/sent-at`)

      expect(res.status).toBe(400)
    })

    it('responds with 404 if not found', async () => {
      jest
        .spyOn(offerAdapter, 'updateOfferSentAt')
        .mockResolvedValueOnce({ ok: false, err: 'no-update' })

      const res = await request(app.callback())
        .put(`/offers/1/sent-at`)
        .send({ sentAt: new Date() })

      expect(res.status).toBe(404)
    })

    it('responds with 200 if ok', async () => {
      jest
        .spyOn(offerAdapter, 'updateOfferSentAt')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback())
        .put(`/offers/1/sent-at`)
        .send({ sentAt: new Date() })

      expect(res.status).toBe(200)
    })
  })
})
