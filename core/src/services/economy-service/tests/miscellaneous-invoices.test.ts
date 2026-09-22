import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as economyAdapter from '../../../adapters/economy-adapter'

import { mockedMiscellaneousInvoices } from '../../../adapters/tests/economy-adapter/mocks'

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('GET /miscellaneous-invoices', () => {
  it('responds with 400 if invalid query params', async () => {
    const res = await request(app.callback()).get(
      '/miscellaneous-invoices?pageSize=notanumber'
    )

    expect(res.status).toBe(400)
  })

  it('responds with 500 if adapter fails', async () => {
    jest
      .spyOn(economyAdapter, 'getMiscellaneousInvoices')
      .mockResolvedValueOnce({ ok: false, err: 'unknown', statusCode: 500 })

    const res = await request(app.callback()).get('/miscellaneous-invoices')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('responds with 200 and content plus pageInfo', async () => {
    jest
      .spyOn(economyAdapter, 'getMiscellaneousInvoices')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          content: mockedMiscellaneousInvoices,
          pageInfo: { hasNextPage: false },
        },
      })

    const res = await request(app.callback()).get('/miscellaneous-invoices')

    expect(res.status).toBe(200)
    expect(res.body.content.content).toHaveLength(
      mockedMiscellaneousInvoices.length
    )
    expect(res.body.content.pageInfo).toEqual({ hasNextPage: false })
  })
})
