import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as listingAdapter from '../../adapters/listing-adapter'
import * as factory from './../factories'
import * as getTenantService from '../../get-tenant'

import { routes } from '../../routes/listings'
import { ListingStatus } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('GET /listing/:listingId/applicants/details', () => {
  it('responds with 404 if no listing found', async () => {
    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get(
      '/listing/1337/applicants/details'
    )
    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
  })

  it('responds with 200 on success', async () => {
    const listingId = 1337
    const applicant1 = factory.applicant.build({
      listingId: listingId,
      nationalRegistrationNumber: '194808075577',
    })

    const applicant2 = factory.applicant.build({
      listingId: listingId,
      nationalRegistrationNumber: '198001011234',
    })

    const listing = factory.listing.build({
      id: listingId,
      publishedFrom: new Date(),
      publishedTo: new Date(),
      vacantFrom: new Date(),
      applicants: [applicant1, applicant2],
    })

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValue({ ok: true, data: factory.tenant.build() })

    const res = await request(app.callback()).get(
      '/listing/1337/applicants/details'
    )
    expect(getListingSpy).toHaveBeenCalled()
    expect(getTenantSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
  })
})

describe('GET /listings-with-applicants', () => {
  const getListingsWithApplicantsSpy = jest.spyOn(
    listingAdapter,
    'getListingsWithApplicants'
  )

  it('responds with 200 and listings', async () => {
    getListingsWithApplicantsSpy.mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(1),
    })

    const res = await request(app.callback()).get('/listings-with-applicants')
    expect(getListingsWithApplicantsSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: expect.any(Number) })],
    })
  })

  it('gets applicants with filter if valid query param', async () => {
    getListingsWithApplicantsSpy.mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(1),
    })

    const res = await request(app.callback()).get(
      '/listings-with-applicants?type=published'
    )
    expect(getListingsWithApplicantsSpy).toHaveBeenCalledWith(
      expect.anything(),
      {
        by: { type: 'published' },
      }
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: expect.any(Number) })],
    })
  })

  it('gets applicants without filter if invalid query param', async () => {
    getListingsWithApplicantsSpy.mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(1),
    })

    const res = await request(app.callback()).get(
      '/listings-with-applicants?type=invalid-value'
    )

    expect(getListingsWithApplicantsSpy).toHaveBeenCalledWith(
      expect.anything(),
      undefined
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: expect.any(Number) })],
    })
  })
})

describe('POST /listings', () => {
  it('responds with 409 if active listing already exists', async () => {
    jest
      .spyOn(listingAdapter, 'createListing')
      .mockResolvedValueOnce({ ok: false, err: 'conflict-active-listing' })

    const res = await request(app.callback()).post('/listings')

    expect(res.status).toBe(409)
  })

  it('responds with 200 on success', async () => {
    jest
      .spyOn(listingAdapter, 'createListing')
      .mockResolvedValueOnce({ ok: true, data: factory.listing.build() })

    const res = await request(app.callback()).post('/listings')
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      content: expect.objectContaining({ id: expect.any(Number) }),
    })
  })
})

describe('PUT /listings/:listingId/status', () => {
  it('responds with 400 if invalid request params', async () => {
    const invalid_prop = await request(app.callback())
      .put('/listings/1/status')
      .send({ foo: 'bar' })

    expect(invalid_prop.status).toBe(400)

    const invalid_value = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: -1 })

    expect(invalid_value.status).toBe(400)
  })

  it('responds with 404 if listing was not found', async () => {
    const updateListingStatuses = jest
      .spyOn(listingAdapter, 'updateListingStatuses')
      .mockResolvedValueOnce({ ok: false, err: 'no-update' })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Expired })

    expect(res.status).toBe(404)
    expect(updateListingStatuses).toHaveBeenCalledTimes(1)
  })

  it('responds with 200 on success', async () => {
    const updateListingStatuses = jest
      .spyOn(listingAdapter, 'updateListingStatuses')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Expired })

    expect(res.status).toBe(200)
    expect(updateListingStatuses).toHaveBeenCalledTimes(1)
  })
})
