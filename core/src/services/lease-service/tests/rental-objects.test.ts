import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('GET /vacant-parkingspaces', () => {
  it('responds with 500 if adapter fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getAllVacantParkingSpaces')
      .mockResolvedValueOnce({
        ok: false,
        err: 'get-all-vacant-parking-spaces-failed',
      })

    const res = await request(app.callback()).get('/vacant-parkingspaces')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('responds with 200 and an empty list if no parking spaces are vacant', async () => {
    jest
      .spyOn(leasingAdapter, 'getAllVacantParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [] })

    const res = await request(app.callback()).get('/vacant-parkingspaces')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('responds with 200 and a list of vacant parking spaces', async () => {
    const vacantParkingSpaces = factory.parkingSpace.buildList(2)

    jest
      .spyOn(leasingAdapter, 'getAllVacantParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: vacantParkingSpaces })

    const res = await request(app.callback()).get('/vacant-parkingspaces')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: expect.any(String),
          address: expect.any(String),
          monthlyRent: expect.any(Number),
          districtCaption: expect.any(String),
          districtCode: expect.any(String),
          propertyCaption: expect.any(String),
          propertyCode: expect.any(String),
          objectTypeCaption: expect.any(String),
          objectTypeCode: expect.any(String),
          residentialAreaCaption: expect.any(String),
          residentialAreaCode: expect.any(String),
          vacantFrom: expect.any(String),
        }),
      ])
    )
  })
})
