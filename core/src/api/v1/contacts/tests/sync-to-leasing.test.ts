import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import { Config } from '@/common/config'

jest.mock('../../../../adapters/contacts-adapter')
jest.mock('../../../../adapters/leasing-adapter')

const mockSync = leasingAdapter.syncContactToLeasing as jest.Mock

const app = new Koa()
const koaRouter = new KoaRouter()
const apiRouter = makeOkapiRouter(koaRouter, {
  openapi: { info: { title: 'test' } },
})
routes(apiRouter, { contactsService: { url: 'http://test' } } as Config)
app.use(koaRouter.routes())

beforeEach(() => jest.clearAllMocks())

describe('POST /v1/contacts/:contactCode/sync-to-leasing', () => {
  it('asks leasing to re-pull the contact and reports it was not skipped', async () => {
    mockSync.mockResolvedValue({ ok: true, data: { skipped: false } })

    const res = await request(app.callback()).post(
      '/v1/contacts/P242036/sync-to-leasing'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ skipped: false })
    expect(mockSync).toHaveBeenCalledWith('P242036')
  })

  it('reports skipped when leasing has no tenant for the code', async () => {
    mockSync.mockResolvedValue({ ok: true, data: { skipped: true } })

    const res = await request(app.callback()).post(
      '/v1/contacts/P242036/sync-to-leasing'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ skipped: true })
  })

  it('answers 502 sync-failed when leasing answers with an error', async () => {
    mockSync.mockResolvedValue({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
    })

    const res = await request(app.callback()).post(
      '/v1/contacts/P242036/sync-to-leasing'
    )

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('sync-failed')
  })

  it('answers 502 leasing-unreachable when leasing cannot be reached', async () => {
    mockSync.mockResolvedValue({ ok: false, err: 'unknown', statusCode: 500 })

    const res = await request(app.callback()).post(
      '/v1/contacts/P242036/sync-to-leasing'
    )

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('leasing-unreachable')
  })
})
