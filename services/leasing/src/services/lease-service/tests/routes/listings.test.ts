import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as listingAdapter from '../../adapters/listing-adapter'
import * as rentalObjectAdapter from '../../adapters/xpand/rental-object-adapter'
import * as factory from './../factories'
import * as getTenantService from '../../get-tenant'

import { routes } from '../../routes/listings'
import { ListingStatus } from '@onecore/types'

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

    const rentalObject = factory.rentalObject
      .params({
        vacantFrom: new Date(),
      })
      .build()

    const listing = factory.listing.build({
      id: listingId,
      publishedFrom: new Date(),
      publishedTo: new Date(),
      rentalObject: rentalObject,
      applicants: [applicant1, applicant2],
    })

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValue({ ok: true, data: factory.tenant.build() })

    const getRentalObjectSpy = jest
      .spyOn(rentalObjectAdapter, 'getParkingSpace')
      .mockResolvedValue({
        ok: true,
        data: factory.rentalObject.build(),
      })

    const res = await request(app.callback()).get(
      '/listing/1337/applicants/details'
    )
    expect(getListingSpy).toHaveBeenCalled()
    expect(getTenantSpy).toHaveBeenCalled()
    expect(getRentalObjectSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
  })
})

describe('GET /listings', () => {
  it('responds with 200 and listings', async () => {
    jest.spyOn(listingAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(3),
    })

    const res = await request(app.callback()).get('/listings')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('responds with 200 and listings with filter for published', async () => {
    jest.spyOn(listingAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(2),
    })

    const res = await request(app.callback()).get('/listings?published=true')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('responds with 200 and listings with filter for rentalRule', async () => {
    jest.spyOn(listingAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(1),
    })

    const res = await request(app.callback()).get('/listings?rentalRule=Scored')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('responds with 500 on unknown error', async () => {
    jest.spyOn(listingAdapter, 'getListings').mockResolvedValueOnce({
      ok: false,
      err: 'unknown',
    })

    const res = await request(app.callback()).get('/listings')
    expect(res.status).toBe(500)
  })

  it('responds with 200 and empty array if no listings found', async () => {
    jest.spyOn(listingAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: [],
    })

    const res = await request(app.callback()).get('/listings')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: [] })
  })

  it('responds with 200 and listings with filter for rentalRule and published', async () => {
    jest.spyOn(listingAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: factory.listing.buildList(2),
    })

    const res = await request(app.callback()).get(
      '/listings?published=true&rentalRule=NonScored'
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
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

describe('POST /listings/batch', () => {
  it('responds with 201 when creating multiple listings successfully', async () => {
    const mockListings = [
      factory.listingWithoutRentalObject.build({
        id: 1,
        rentalObjectCode: 'P001',
      }),
      factory.listingWithoutRentalObject.build({
        id: 2,
        rentalObjectCode: 'P002',
      }),
    ]

    const createMultipleListingsSpy = jest
      .spyOn(listingAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: true,
        data: mockListings,
      })

    const testData = {
      listings: [
        {
          rentalObjectCode: 'P001',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: ListingStatus.Active,
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        },
        {
          rentalObjectCode: 'P002',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: ListingStatus.Active,
          rentalRule: 'NON_SCORED',
          listingCategory: 'PARKING_SPACE',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(createMultipleListingsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: 'P001',
          status: ListingStatus.Active,
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        }),
        expect.objectContaining({
          rentalObjectCode: 'P002',
          status: ListingStatus.Active,
          rentalRule: 'NON_SCORED',
          listingCategory: 'PARKING_SPACE',
        }),
      ])
    )

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          rentalObjectCode: expect.any(String),
          publishedFrom: expect.any(String),
          publishedTo: expect.any(String),
          status: expect.any(Number),
          rentalRule: expect.any(String),
          listingCategory: expect.any(String),
          applicants: expect.any(Array),
        }),
      ]),
      message: 'Successfully created 2 listings',
    })
  })

  it('responds with 207 when partial failure occurs', async () => {
    const createMultipleListingsSpy = jest
      .spyOn(listingAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: false,
        err: 'partial-failure',
      })

    const testData = {
      listings: [
        {
          rentalObjectCode: 'P003',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: ListingStatus.Active,
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        },
        {
          rentalObjectCode: 'P003', // Duplicate - should cause conflict
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: ListingStatus.Active,
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(createMultipleListingsSpy).toHaveBeenCalled()
    expect(res.status).toBe(207)
    expect(res.body).toEqual({
      error: 'Some listings failed to create',
      message:
        'Partial success - some listings were created successfully while others failed',
    })
  })

  it('responds with 400 when request body is invalid', async () => {
    const testData = {
      listings: [
        {
          rentalObjectCode: 'P004',
          // Missing required fields
        },
      ],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid request body',
      details: expect.any(Array),
    })
  })

  it('responds with 201 when creating empty listings array', async () => {
    const createMultipleListingsSpy = jest
      .spyOn(listingAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: true,
        data: [],
      })

    const testData = {
      listings: [],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(createMultipleListingsSpy).toHaveBeenCalledWith([])
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      content: [],
      message: 'Successfully created 0 listings',
    })
  })

  it('responds with 500 when adapter returns unknown error', async () => {
    const createMultipleListingsSpy = jest
      .spyOn(listingAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

    const testData = {
      listings: [
        {
          rentalObjectCode: 'P005',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: ListingStatus.Active,
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(createMultipleListingsSpy).toHaveBeenCalled()
    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to create listings',
    })
  })
})
