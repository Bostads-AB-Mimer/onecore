import request from 'supertest'
import { makeTestApp } from './app-fixture'

const apartment = {
  rentalObjectCode: '123-456-01-0101',
  address: 'Trädgårdsgatan 19',
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
  rentalTenureType: { id: 'STUD', name: 'Studentbostad' },
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
