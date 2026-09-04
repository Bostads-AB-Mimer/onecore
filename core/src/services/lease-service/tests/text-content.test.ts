import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('POST /listing-text-content/existence', () => {
  it('responds with 200 and the subset of codes that have content', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingTextContentExistence')
      .mockResolvedValueOnce({ ok: true, data: ['CODE-1'] })

    const res = await request(app.callback())
      .post('/listing-text-content/existence')
      .send({ rentalObjectCodes: ['CODE-1', 'CODE-2'] })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(['CODE-1'])
  })

  it('responds with 400 for invalid body', async () => {
    const res = await request(app.callback())
      .post('/listing-text-content/existence')
      .send({ rentalObjectCodes: [] })

    expect(res.status).toBe(400)
  })

  it('responds with 500 if adapter fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingTextContentExistence')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .post('/listing-text-content/existence')
      .send({ rentalObjectCodes: ['CODE-1'] })

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})
