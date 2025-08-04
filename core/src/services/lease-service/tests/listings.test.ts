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

  it('responds with 200 on success with filter on validToRentForContactCode', async () => {
    const listing = factory.listing.build({
      id: 1337,
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

    const res = await request(app.callback()).get(
      '/listings?validToRentForContactCode=abc123'
    )

    expect(getListingsSpy).toHaveBeenCalledWith({
      validToRentForContactCode: 'abc123',
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: [expect.objectContaining({ id: 1337 })],
    })
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
