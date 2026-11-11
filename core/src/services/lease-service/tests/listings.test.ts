import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as apartmentRentalObjects from '../helpers/apartment-rental-objects'
import * as communicationAdapter from '../../../adapters/communication-adapter'

import * as factory from '../../../../test/factories'
import {
  ApplicantStatus,
  CreateOfferErrorCodes,
  GetActiveOfferByListingIdErrorCodes,
  ListingStatus,
  UpdateListingStatusErrorCodes,
} from '@onecore/types'

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

describe('listings for apartments', () => {
  const apartmentListing = (id: number, rentalObjectCode: string) =>
    factory.listing.build({
      id,
      rentalObjectCode,
      listingCategory: 'APARTMENT',
      rentalRule: 'SCORED',
    })

  it('GET /listings returns apartment and parking listings with their rental objects', async () => {
    jest.spyOn(tenantLeaseAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.listing.build({ id: 1, rentalObjectCode: 'P1' }),
        apartmentListing(2, 'A1'),
      ],
    })
    jest.spyOn(tenantLeaseAdapter, 'getParkingSpaces').mockResolvedValueOnce({
      ok: true,
      data: [factory.rentalObject.build({ rentalObjectCode: 'P1' })],
    })
    jest.spyOn(apartmentRentalObjects, 'getApartments').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.rentalObject.build({
          rentalObjectCode: 'A1',
          objectTypeCaption: '3 rum och kök',
          floor: '4',
          roomCount: 3,
        }),
      ],
    })

    const res = await request(app.callback()).get('/listings')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      expect.objectContaining({
        id: 1,
        rentalObject: expect.objectContaining({ rentalObjectCode: 'P1' }),
      }),
      expect.objectContaining({
        id: 2,
        rentalObject: expect.objectContaining({
          rentalObjectCode: 'A1',
          objectTypeCaption: '3 rum och kök',
          floor: '4',
          roomCount: 3,
        }),
      }),
    ])
  })

  it('GET /listings still returns parking listings when the apartment lookup fails', async () => {
    jest.spyOn(tenantLeaseAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.listing.build({ id: 1, rentalObjectCode: 'P1' }),
        apartmentListing(2, 'A1'),
      ],
    })
    jest.spyOn(tenantLeaseAdapter, 'getParkingSpaces').mockResolvedValueOnce({
      ok: true,
      data: [factory.rentalObject.build({ rentalObjectCode: 'P1' })],
    })
    jest
      .spyOn(apartmentRentalObjects, 'getApartments')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/listings')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([expect.objectContaining({ id: 1 })])
  })

  it('GET /listings does not apply the parking space area rule to apartments', async () => {
    jest.spyOn(tenantLeaseAdapter, 'getListings').mockResolvedValueOnce({
      ok: true,
      data: [apartmentListing(2, 'A1')],
    })
    jest.spyOn(apartmentRentalObjects, 'getApartments').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.rentalObject.build({
          rentalObjectCode: 'A1',
          residentialAreaCode: 'ANOTHER_AREA',
        }),
      ],
    })
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

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([expect.objectContaining({ id: 2 })])
  })

  it('GET /listings returns an empty list without looking up rental objects when there are no listings', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getListings')
      .mockResolvedValueOnce({ ok: true, data: [] })
    const parkingSpy = jest.spyOn(tenantLeaseAdapter, 'getParkingSpaces')

    const res = await request(app.callback()).get('/listings')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
    expect(parkingSpy).not.toHaveBeenCalled()
  })

  it('GET /listings/:id returns an apartment listing with its rental object', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(apartmentListing(2, 'A1'))
    jest.spyOn(apartmentRentalObjects, 'getApartments').mockResolvedValueOnce({
      ok: true,
      data: [factory.rentalObject.build({ rentalObjectCode: 'A1' })],
    })
    const parkingSpy = jest.spyOn(tenantLeaseAdapter, 'getParkingSpaceByCode')

    const res = await request(app.callback()).get('/listings/2')

    expect(res.status).toBe(200)
    expect(res.body.content.rentalObject.rentalObjectCode).toBe('A1')
    expect(parkingSpy).not.toHaveBeenCalled()
  })

  it.each<
    [
      string,
      Awaited<ReturnType<typeof apartmentRentalObjects.getApartments>>,
      number,
    ]
  >([
    ['is not a listable apartment', { ok: true, data: [] }, 404],
    ['lookup fails', { ok: false, err: 'unknown' }, 500],
  ])(
    'GET /listings/:id responds when the apartment %s',
    async (_, result, status) => {
      jest
        .spyOn(tenantLeaseAdapter, 'getListingByListingId')
        .mockResolvedValueOnce(apartmentListing(2, 'A1'))
      jest
        .spyOn(apartmentRentalObjects, 'getApartments')
        .mockResolvedValueOnce(result)

      const res = await request(app.callback()).get('/listings/2')

      expect(res.status).toBe(status)
    }
  )

  it('GET /listings-with-applicants includes apartment listings', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getListingsWithApplicants')
      .mockResolvedValueOnce({ ok: true, data: [apartmentListing(2, 'A1')] })
    jest.spyOn(apartmentRentalObjects, 'getApartments').mockResolvedValueOnce({
      ok: true,
      data: [factory.rentalObject.build({ rentalObjectCode: 'A1' })],
    })

    const res = await request(app.callback()).get('/listings-with-applicants')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      expect.objectContaining({
        id: 2,
        rentalObject: expect.objectContaining({ rentalObjectCode: 'A1' }),
      }),
    ])
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

describe('PUT /listings/:listingId/status', () => {
  it('should return error and correct status if updateListingStatus fails', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({
        ok: false,
        err: UpdateListingStatusErrorCodes.Unknown,
      })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(res.status).toBe(500)
  })
  it('should remove active applications when status is set to Closed', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: [
          factory.detailedApplicant.build({
            id: 1,
            listingId: 1,
            status: ApplicantStatus.Active,
          }),
          factory.detailedApplicant.build({
            id: 2,
            listingId: 1,
            status: ApplicantStatus.Active,
          }),
          factory.detailedApplicant.build({
            id: 3,
            listingId: 1,
            status: ApplicantStatus.Offered,
          }),
        ],
      })

    const withdrawSpy = jest
      .spyOn(tenantLeaseAdapter, 'withdrawApplicantByManager')
      .mockResolvedValue({ ok: true })

    await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(withdrawSpy).toHaveBeenCalledTimes(2)
  })

  it('should handle error when getDetailedApplicantsByListingId fails', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: false,
        err: UpdateListingStatusErrorCodes.Unknown,
      })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
  it('should deny open offers when closing listing', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })

    const getActiveOfferByListingIdSpy = jest
      .spyOn(tenantLeaseAdapter, 'getActiveOfferByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.offer.build({ id: 42 }),
      })

    const closeOfferByDenySpy = jest
      .spyOn(tenantLeaseAdapter, 'closeOfferByDeny')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(getActiveOfferByListingIdSpy).toHaveBeenCalledWith(1)
    expect(closeOfferByDenySpy).toHaveBeenCalledWith(42)
    expect(res.status).toBe(200)
  })
  it('should handle error when getActiveOfferByListingId fails', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })

    jest
      .spyOn(tenantLeaseAdapter, 'getActiveOfferByListingId')
      .mockResolvedValueOnce({
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.Unknown,
      })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
  it('should handle error when closeOfferByDeny fails', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })

    jest
      .spyOn(tenantLeaseAdapter, 'getActiveOfferByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.offer.build({ id: 42 }),
      })

    jest.spyOn(tenantLeaseAdapter, 'closeOfferByDeny').mockResolvedValueOnce({
      ok: false,
      err: UpdateListingStatusErrorCodes.Unknown,
    })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
  it('should return 200 and metadata if everything succeeds', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })

    jest
      .spyOn(tenantLeaseAdapter, 'getActiveOfferByListingId')
      .mockResolvedValueOnce({
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.NotFound,
      })

    const res = await request(app.callback())
      .put('/listings/1/status')
      .send({ status: ListingStatus.Closed })

    expect(res.status).toBe(200)
  })
})

describe('POST /listings/:listingId/offers', () => {
  it('responds with 201 on success', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(tenantLeaseAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)
    jest.spyOn(tenantLeaseAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({ rentalObjectCode: listing.rentalObjectCode })
        .build(),
    })
    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.detailedApplicant.buildList(1),
      })
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(tenantLeaseAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(tenantLeaseAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(tenantLeaseAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })
    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback()).post('/listings/1/offers')

    expect(res.status).toBe(201)
  })

  it('responds with 404 when there is no eligible applicant, not 500', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(tenantLeaseAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)
    jest.spyOn(tenantLeaseAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({ rentalObjectCode: listing.rentalObjectCode })
        .build(),
    })
    jest
      .spyOn(tenantLeaseAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })
    jest
      .spyOn(tenantLeaseAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback()).post('/listings/1/offers')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe(CreateOfferErrorCodes.NoApplicants)
  })

  it('responds with 500 for an actual technical failure', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getListingByListingId')
      .mockResolvedValue(undefined)

    const res = await request(app.callback()).post('/listings/1/offers')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe(CreateOfferErrorCodes.NoListing)
  })
})

describe('POST /listings', () => {
  it('responds with 201 on success', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'createNewListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    const res = await request(app.callback()).post('/listings').send({
      rentalObjectCode: 'R1001',
      listingCategory: 'APARTMENT',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalObjectCode: 'R1001',
        listingCategory: 'APARTMENT',
      })
    )
    expect(res.status).toBe(201)
    expect(res.body.content).toEqual(
      JSON.parse(JSON.stringify(listing)) // dates round-trip through JSON as strings
    )
  })

  it('responds with 400 for a listingCategory other than APARTMENT', async () => {
    const spy = jest.spyOn(tenantLeaseAdapter, 'createNewListing')

    const res = await request(app.callback()).post('/listings').send({
      rentalObjectCode: 'R1001',
      listingCategory: 'PARKING_SPACE',
    })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('responds with 409 when an active listing already exists', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'createNewListing')
      .mockResolvedValueOnce({ ok: false, err: 'conflict' })

    const res = await request(app.callback()).post('/listings').send({
      rentalObjectCode: 'R1001',
      listingCategory: 'APARTMENT',
    })

    expect(res.status).toBe(409)
  })

  it('responds with 500 on an unexpected adapter error', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'createNewListing')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).post('/listings').send({
      rentalObjectCode: 'R1001',
      listingCategory: 'APARTMENT',
    })

    expect(res.status).toBe(500)
  })
})

describe('PATCH /listings/:listingId', () => {
  const TEST_USER = {
    email: 'reviewer@mimer.se',
    name: 'Rut Reviewer',
    preferred_username: 'rutr',
  }
  let mockUser: Partial<typeof TEST_USER> | undefined = TEST_USER

  const appWithUser = new Koa()
  const routerWithUser = new KoaRouter()
  routes(routerWithUser)
  appWithUser.use(bodyParser())
  appWithUser.use((ctx, next) => {
    ctx.state.user = mockUser
    return next()
  })
  appWithUser.use(routerWithUser.routes())

  beforeEach(() => {
    mockUser = TEST_USER
  })

  it('responds with 400 for a non-numeric listingId', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    const res = await request(appWithUser.callback())
      .patch('/listings/not-a-number')
      .send({ reviewedAt: new Date().toISOString() })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-listing-id')
    expect(spy).not.toHaveBeenCalled()
  })

  it.each(['0x10', '1e2', '1.5'])(
    'responds with 400 for a non-decimal-looking listingId (%s)',
    async (listingId) => {
      const spy = jest.spyOn(tenantLeaseAdapter, 'updateListing')

      const res = await request(appWithUser.callback())
        .patch(`/listings/${listingId}`)
        .send({ reviewedAt: new Date().toISOString() })

      expect(res.status).toBe(400)
      expect(spy).not.toHaveBeenCalled()
    }
  )

  it('falls back to preferred_username when name is an empty string', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    mockUser = { name: '', preferred_username: 'rutr', email: 'r@mimer.se' }
    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({ reviewedAt: new Date().toISOString() })

    expect(spy).toHaveBeenCalledWith(
      1337,
      expect.objectContaining({ reviewedBy: 'rutr' })
    )
  })

  it('clears reviewedAt too when only reviewedBy is sent, instead of leaving a reviewed-by-nobody row', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({ reviewedBy: 'someone-the-client-made-up' })

    expect(spy).toHaveBeenCalledWith(
      1337,
      expect.objectContaining({ reviewedAt: null, reviewedBy: null })
    )
  })

  it('sets reviewedBy from the authenticated user, ignoring the client-supplied value', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'someone-the-client-made-up',
      })

    expect(spy).toHaveBeenCalledWith(
      1337,
      expect.objectContaining({ reviewedBy: 'Rut Reviewer' })
    )
  })

  it('falls back to preferred_username, then email, when name is missing', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValue({ ok: true, data: listing })

    mockUser = { preferred_username: 'rutr', email: 'reviewer@mimer.se' }
    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({ reviewedAt: new Date().toISOString() })

    expect(spy).toHaveBeenCalledWith(
      1337,
      expect.objectContaining({ reviewedBy: 'rutr' })
    )

    mockUser = { email: 'reviewer@mimer.se' }
    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({ reviewedAt: new Date().toISOString() })

    expect(spy).toHaveBeenLastCalledWith(
      1337,
      expect.objectContaining({ reviewedBy: 'reviewer@mimer.se' })
    )
  })

  it('clears reviewedBy when reviewedAt is cleared, regardless of the client-supplied value', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({ reviewedAt: null, reviewedBy: 'someone-the-client-made-up' })

    expect(spy).toHaveBeenCalledWith(
      1337,
      expect.objectContaining({ reviewedAt: null, reviewedBy: null })
    )
  })

  it('leaves reviewedBy untouched when the request does not mention review at all', async () => {
    const listing = factory.listing.build({ id: 1337 })
    const spy = jest
      .spyOn(tenantLeaseAdapter, 'updateListing')
      .mockResolvedValueOnce({ ok: true, data: listing })

    await request(appWithUser.callback())
      .patch('/listings/1337')
      .send({ publishedTo: new Date().toISOString() })

    const [, update] = spy.mock.calls[0]
    expect(update).not.toHaveProperty('reviewedBy')
  })
})
