import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as propertyBaseRoutes } from '../index'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

function app() {
  const a = new Koa()
  const r = new KoaRouter()
  a.use(bodyParser())
  propertyBaseRoutes(r)
  a.use(r.routes())
  return a
}

beforeEach(jest.resetAllMocks)

describe('GET /residences/rental-blocks/rental-ids', () => {
  it('passes the query through and returns the ids', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getRentalIdsWithBlock')
      .mockResolvedValue({ ok: true, data: ['705-022-04-0201'] })

    const res = await request(app().callback()).get(
      '/residences/rental-blocks/rental-ids?blockReason=SKADEDJUR&active=true'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(['705-022-04-0201'])
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ blockReason: 'SKADEDJUR', active: 'true' })
    )
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getRentalIdsWithBlock')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    const res = await request(app().callback()).get(
      '/residences/rental-blocks/rental-ids?blockReason=SKADEDJUR'
    )

    expect(res.status).toBe(500)
  })
})
