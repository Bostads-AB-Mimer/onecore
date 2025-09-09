import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'

import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('GET /listings', () => {
  it('responds with 200 on success with no filter', async () => {
    const listing = factory.listing.build({
      id: 1337,
    })

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [listing] })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [] })

    const res = await request(app.callback()).get('/listings')

    expect(getListingsSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
  })

  it('responds with 200 on success with filter on published', async () => {
    const listing = factory.listing.build({
      id: 1337,
      publishedFrom: new Date(),
      publishedTo: new Date(),
      rentalObjectCode: '12345',
    })
    const parkingSpace = factory.vacantParkingSpace.build({
      rentalObjectCode: '12345',
    })

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [listing] })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [parkingSpace] })

    const res = await request(app.callback()).get('/listings?published=true')

    expect(getListingsSpy).toHaveBeenCalledWith({ published: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
  })

  it('responds with 200 on success with filter on published', async () => {
    const listing = factory.listing.build({
      id: 1337,
      publishedFrom: new Date(),
      publishedTo: new Date(),
      rentalObjectCode: '12345',
    })
    const parkingSpace = factory.vacantParkingSpace.build({
      rentalObjectCode: '12345',
    })

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [listing] })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [parkingSpace] })

    const res = await request(app.callback()).get('/listings?published=true')

    expect(getListingsSpy).toHaveBeenCalledWith({ published: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
  })

  it('responds with 200 on success with filter on rentalRule', async () => {
    const listing = factory.listing.build({
      id: 1337,
      rentalRule: 'SCORED',
      rentalObjectCode: '12345',
    })
    const parkingSpace = factory.vacantParkingSpace.build({
      rentalObjectCode: '12345',
    })

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [listing] })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [parkingSpace] })

    const res = await request(app.callback()).get('/listings?rentalRule=SCORED')

    expect(getListingsSpy).toHaveBeenCalledWith({
      rentalRule: 'SCORED',
      published: undefined,
      listingCategory: undefined,
      validToRentForContactCode: undefined,
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
  })

  it('responds with 200 on success with filter on rentalObjectCode', async () => {
    const listing = factory.listing.build({
      id: 1337,
      rentalRule: 'SCORED',
      rentalObjectCode: '12345',
    })
    const parkingSpace = factory.vacantParkingSpace.build({
      rentalObjectCode: '12345',
      residentialAreaCode: 'AREA123',
    })

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [listing] })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [parkingSpace] })

    jest
      .spyOn(tenantLeaseAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.tenant.build({
          currentHousingContract: { residentialArea: { code: 'AREA123' } },
        }),
      })

    const res = await request(app.callback()).get(
      '/listings?rentalObjectCode=12345'
    )

    expect(getListingsSpy).toHaveBeenCalledWith({
      rentalObjectCode: '12345',
      published: undefined,
      listingCategory: undefined,
      validToRentForContactCode: undefined,
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
  })

  it('responds with 200 on success with filter on validToRentForContactCode', async () => {
    const listing = factory.listing.build({
      id: 1337,
      rentalObjectCode: '12345',
    })
    const parkingSpace = factory.vacantParkingSpace.build({
      rentalObjectCode: '12345',
      residentialAreaCode: 'AREA123',
    })

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [listing] })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [parkingSpace] })

    jest
      .spyOn(tenantLeaseAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.tenant.build({
          currentHousingContract: { residentialArea: { code: 'AREA123' } },
        }),
      })

    const res = await request(app.callback()).get(
      '/listings?validToRentForContactCode=abc123'
    )

    expect(getListingsSpy).toHaveBeenCalledWith({
      listingCategory: undefined,
      published: undefined,
      rentalRule: undefined,
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
  })

  it('responds with a filtered list with filter on validToRentForContactCode', async () => {
    const listings = [
      factory.listing.build({
        id: 1337,
        rentalObjectCode: '12345',
      }),
      factory.listing.build({
        id: 1339,
        rentalObjectCode: '32345',
      }),
    ]
    const parkingSpaces = [
      factory.vacantParkingSpace.build({
        rentalObjectCode: '12345',
        residentialAreaCode: 'AREA123',
      }),
      factory.vacantParkingSpace.build({
        rentalObjectCode: '32345',
        residentialAreaCode: 'ANOTHER_AREA',
      }),
    ]

    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: listings })

    jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: parkingSpaces })

    jest
      .spyOn(tenantLeaseAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.tenant.build({
          currentHousingContract: { residentialArea: { code: 'AREA123' } },
        }),
      })

    const res = await request(app.callback()).get(
      '/listings?validToRentForContactCode=abc123'
    )

    expect(getListingsSpy).toHaveBeenCalledWith({
      listingCategory: undefined,
      published: undefined,
      rentalRule: undefined,
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
    expect(res.body.content).toHaveLength(1)
  })

  it('responds with 500 on error', async () => {
    const getListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/listings')

    expect(getListingsSpy).toHaveBeenCalled()
    expect(res.status).toBe(500)
  })
})

describe('POST /listings/batch', () => {
  it('responds with 201 when creating multiple listings successfully', async () => {
    const mockCreatedListings = [
      factory.listing.build({
        id: 1,
        rentalObjectCode: 'P001',
      }),
      factory.listing.build({
        id: 2,
        rentalObjectCode: 'P002',
      }),
    ]

    const mockParkingSpaces = [
      factory.vacantParkingSpace.build({
        rentalObjectCode: 'P001',
      }),
      factory.vacantParkingSpace.build({
        rentalObjectCode: 'P002',
      }),
    ]

    const createMultipleListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: true,
        data: mockCreatedListings,
      })

    const getParkingSpacesSpy = jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({
        ok: true,
        data: mockParkingSpaces,
      })

    const testData = {
      listings: [
        {
          rentalObjectCode: 'P001',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: 1, // Active
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        },
        {
          rentalObjectCode: 'P002',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: 1, // Active
          rentalRule: 'NON_SCORED',
          listingCategory: 'PARKING_SPACE',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(createMultipleListingsSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        rentalObjectCode: 'P001',
        status: 1,
        rentalRule: 'SCORED',
        listingCategory: 'PARKING_SPACE',
      }),
      expect.objectContaining({
        rentalObjectCode: 'P002',
        status: 1,
        rentalRule: 'NON_SCORED',
        listingCategory: 'PARKING_SPACE',
      }),
    ])

    expect(getParkingSpacesSpy).toHaveBeenCalledWith(['P001', 'P002'])
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: 'P001',
          rentalObject: expect.any(Object),
        }),
        expect.objectContaining({
          rentalObjectCode: 'P002',
          rentalObject: expect.any(Object),
        }),
      ]),
      message: 'Successfully created 2 listings',
    })
  })

  it('responds with 207 when partial failure occurs', async () => {
    const createMultipleListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'createMultipleListings')
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
          status: 1,
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
      error: 'Some listings could not be created',
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

  it('responds with 201 even when parking spaces cannot be fetched', async () => {
    const mockCreatedListings = [
      factory.listing.build({
        id: 1,
        rentalObjectCode: 'P005',
      }),
    ]

    const createMultipleListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: true,
        data: mockCreatedListings,
      })

    const getParkingSpacesSpy = jest
      .spyOn(tenantLeaseAdapter, 'getParkingSpaces')
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
          status: 1,
          rentalRule: 'SCORED',
          listingCategory: 'PARKING_SPACE',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/listings/batch')
      .send(testData)

    expect(createMultipleListingsSpy).toHaveBeenCalled()
    expect(getParkingSpacesSpy).toHaveBeenCalled()
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: 'P005',
        }),
      ]),
      message: 'Successfully created 1 listings',
    })
  })

  it('responds with 500 when adapter returns unknown error', async () => {
    const createMultipleListingsSpy = jest
      .spyOn(tenantLeaseAdapter, 'createMultipleListings')
      .mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

    const testData = {
      listings: [
        {
          rentalObjectCode: 'P006',
          publishedFrom: '2024-01-01T00:00:00Z',
          publishedTo: '2024-12-31T23:59:59Z',
          status: 1,
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
