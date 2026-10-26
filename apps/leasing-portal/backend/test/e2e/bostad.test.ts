import request from 'supertest'
import { makeTestApp } from './app-fixture'

const apartment = {
  rentalObjectCode: '123-456-01-0101',
  address: {
    street: 'Trädgårdsgatan 19',
    street2: null,
    postalCode: '722 12',
    city: 'Västerås',
  },
  apartmentNumber: '1203',
  propertyCode: '123-456',
  propertyName: 'LINDAREN 2',
  buildingCode: '123-456-01',
  marketAreaCode: 'VAS',
  marketAreaName: 'Vasastan',
  residenceTypeName: '4 rum och kök',
  roomCount: 4,
  floor: '4',
  elevator: true,
  area: 102,
  rent: 14200,
  rentalTenureType: { id: 'STD', name: 'Standard' },
  rentalTags: [],
  vacantFrom: '2026-10-22T00:00:00.000Z',
  block: null,
  listing: null,
  closedListingsSinceLastLease: 0,
}

describe('GET /leasing-portal/bostad/vacant-apartments', () => {
  it('rejects requests without a token', async () => {
    const { app, coreClient } = makeTestApp()

    const res = await request(app.callback()).get(
      '/leasing-portal/bostad/vacant-apartments'
    )

    expect(res.status).toBe(401)
    expect(coreClient.calls).toHaveLength(0)
  })

  it('passes the list through from core', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: true,
      statusCode: 200,
      data: { content: [apartment], _links: [] },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/vacant-apartments')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: [apartment] })
    expect(coreClient.calls).toEqual([
      {
        accessToken: 'cookie-token',
        req: { method: 'get', path: '/vacant-apartments' },
      },
    ])
  })

  it('answers 502 when core sends an unexpected shape', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({ ok: true, statusCode: 200, data: { nope: 1 } })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/vacant-apartments')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'unexpected-core-response' })
  })

  it('forwards a core failure as 502 with core’s reason', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: false,
      statusCode: 500,
      err: { error: 'get-availabilities-failed' },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/vacant-apartments')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'get-availabilities-failed' })
  })
})

const coreListing = {
  id: 42,
  rentalObjectCode: '234-234-234-1009',
  publishedFrom: '2026-09-23T00:00:00.000Z',
  publishedTo: '2026-09-30T00:00:00.000Z',
  status: 1,
  rentalRule: 'SCORED',
  listingCategory: 'APARTMENT',
  reviewedAt: null,
  reviewedBy: null,
  applicants: [
    {
      id: 1,
      name: 'Eva',
      nationalRegistrationNumber: '19751014-4455',
      contactCode: 'P1',
      applicationDate: '2026-09-24T00:00:00.000Z',
      applicationType: 'Additional',
      status: 1,
      listingId: 42,
    },
    {
      id: 2,
      name: 'Mikael',
      nationalRegistrationNumber: '19811203-9988',
      contactCode: 'P2',
      applicationDate: '2026-09-25T00:00:00.000Z',
      applicationType: 'Additional',
      status: 4,
      listingId: 42,
    },
    {
      id: 3,
      name: 'Anna',
      nationalRegistrationNumber: '19900101-1234',
      contactCode: 'P3',
      applicationDate: '2026-09-26T00:00:00.000Z',
      applicationType: 'Additional',
      status: 5,
      listingId: 42,
    },
    {
      id: 4,
      name: 'Olle',
      nationalRegistrationNumber: '19850505-5678',
      contactCode: 'P4',
      applicationDate: '2026-09-27T00:00:00.000Z',
      applicationType: 'Additional',
      status: 6,
      listingId: 42,
    },
  ],
  rentalObject: {
    rentalObjectCode: '234-234-234-1009',
    address: 'Järnvägsgatan 28',
    propertyCode: '12001',
    propertyCaption: 'JOHAN 4',
    residentialAreaCode: 'MAL',
    residentialAreaCaption: 'Malmaberg',
    objectTypeCode: '3RK',
    objectTypeCaption: '3 rum och kök',
    boaArea: 78,
    floor: '4',
    roomCount: 3,
    availabilityInfo: {
      rentalObjectCode: '234-234-234-1009',
      vacantFrom: '2026-11-01T00:00:00.000Z',
      rent: { amount: 10200, vat: 0, rows: [] },
      rentalTenureType: { id: 'STD', name: 'Standard' },
      rentalTags: [],
    },
  },
}

describe('GET /leasing-portal/bostad/listings/:listingId', () => {
  it('returns the listing cut to what the page shows, counting active applicants', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: true,
      statusCode: 200,
      data: { content: coreListing, _links: [] },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/42')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: {
        id: 42,
        status: 1,
        publishedTo: '2026-09-30T00:00:00.000Z',
        rentalObjectCode: '234-234-234-1009',
        address: 'Järnvägsgatan 28',
        areaName: 'Malmaberg',
        tenureType: { id: 'STD', name: 'Standard' },
        roomCount: 3,
        size: 78,
        floor: '4',
        rent: 10200,
        vacantFrom: '2026-11-01T00:00:00.000Z',
        // Active and offered count; withdrawn by the user or a manager do not.
        activeApplicantCount: 2,
      },
    })
    expect(coreClient.calls).toEqual([
      {
        accessToken: 'cookie-token',
        req: { method: 'get', path: '/listings/42' },
      },
    ])
  })

  it('never sends applicants’ names or personal numbers to the page', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: true,
      statusCode: 200,
      data: { content: coreListing },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/42')
      .set('Cookie', 'auth_token=cookie-token')

    expect(JSON.stringify(res.body)).not.toMatch(/19751014|Eva/)
  })

  it('leaves Tenfast fields empty when core has no availability', async () => {
    const { app, coreClient } = makeTestApp()
    const { availabilityInfo: _, ...withoutAvailability } =
      coreListing.rentalObject
    coreClient.respondWith({
      ok: true,
      statusCode: 200,
      data: {
        content: {
          ...coreListing,
          publishedTo: null,
          rentalObject: withoutAvailability,
        },
      },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/42')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      tenureType: null,
      rent: null,
      vacantFrom: null,
      publishedTo: null,
    })
  })

  it('answers 400 for an id that is not a number, without calling core', async () => {
    const { app, coreClient } = makeTestApp()

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/abc')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid-listing-id' })
    expect(coreClient.calls).toHaveLength(0)
  })

  it('answers 404 for a listing that is not an apartment', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: true,
      statusCode: 200,
      data: { content: { ...coreListing, listingCategory: 'PARKING_SPACE' } },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/42')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(404)
  })

  it('passes core’s 404 through', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: false,
      statusCode: 404,
      err: { error: 'Listing not found' },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/42')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Listing not found' })
  })

  it('answers 502 when core sends an unexpected shape', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({ ok: true, statusCode: 200, data: { nope: 1 } })

    const res = await request(app.callback())
      .get('/leasing-portal/bostad/listings/42')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'unexpected-core-response' })
  })

  it('rejects requests without a token', async () => {
    const res = await request(makeTestApp().app.callback()).get(
      '/leasing-portal/bostad/listings/42'
    )
    expect(res.status).toBe(401)
  })
})
