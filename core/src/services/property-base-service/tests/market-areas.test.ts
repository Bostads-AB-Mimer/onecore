import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as marketAreaRoutes } from '../market-areas'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

function app() {
  const a = new Koa()
  const r = new KoaRouter()
  a.use(bodyParser())
  marketAreaRoutes(r)
  a.use(r.routes())
  return a
}

beforeEach(jest.resetAllMocks)

describe('GET /market-areas', () => {
  it('returns every market area', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'listMarketAreas')
      .mockResolvedValueOnce({
        ok: true,
        data: [
          { id: '111111111111112', code: 'MO1', name: 'Marknadsområde 1' },
          { id: '111111111111113', code: 'MO2', name: null },
        ],
      })

    const res = await request(app().callback()).get('/market-areas')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      { id: '111111111111112', code: 'MO1', name: 'Marknadsområde 1' },
      { id: '111111111111113', code: 'MO2', name: null },
    ])
    expect(spy).toHaveBeenCalledWith()
  })

  it('returns 500 when the property service reports an unknown error', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listMarketAreas')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app().callback()).get('/market-areas')

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('Internal server error')
  })
})
