jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/contacts'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('GET /contacts/search', () => {
  it('responds with 400 if query param is missing', async () => {
    const res = await request(app.callback()).get('/contacts/search')
    expect(res.status).toBe(400)
  })

  it('responds with 500 if error', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
      .mockResolvedValueOnce({ ok: false, err: 'internal-error' })

    const res = await request(app.callback()).get('/contacts/search?q=foo')
    expect(res.status).toBe(500)
  })

  it('returns a list of contact data', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
      .mockResolvedValueOnce({
        ok: true,
        data: [{ contactCode: 'foo', fullName: 'Foo Bar' }],
      })

    const res = await request(app.callback()).get('/contacts/search?q=foo')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({ contactCode: 'foo', fullName: 'Foo Bar' }),
      ]),
    })
  })
})
