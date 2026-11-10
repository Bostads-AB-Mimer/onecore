import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import { MAX_SYNC_TO_LEASING_CONTACT_CODES } from '../schema'
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
app.use(bodyParser())
app.use(koaRouter.routes())

const sync = (body: object | undefined) =>
  request(app.callback()).post('/v1/contacts/sync-to-leasing').send(body)

beforeEach(() => {
  jest.clearAllMocks()
  mockSync.mockResolvedValue({ ok: true, data: { skipped: false } })
})

describe('POST /v1/contacts/sync-to-leasing', () => {
  it('syncs every code and reports an outcome per code', async () => {
    mockSync.mockImplementation(async (code: string) => {
      switch (code) {
        case 'P000001':
          return { ok: true, data: { skipped: false } }
        case 'P000002':
          return { ok: true, data: { skipped: true } }
        case 'P000003':
          return { ok: false, err: 'sync-failed', statusCode: 500 }
        default:
          return { ok: false, err: 'unknown', statusCode: 500 }
      }
    })

    const res = await sync({
      contactCodes: ['P000001', 'P000002', 'P000003', 'P000004'],
    })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      results: [
        { contactCode: 'P000001', status: 'synced' },
        { contactCode: 'P000002', status: 'skipped' },
        { contactCode: 'P000003', status: 'sync-failed' },
        { contactCode: 'P000004', status: 'leasing-unreachable' },
      ],
      synced: 1,
      skipped: 1,
      failed: 2,
    })
  })

  it('syncs a duplicated or padded code once', async () => {
    const res = await sync({ contactCodes: ['P242036', ' P242036 '] })

    expect(res.status).toBe(200)
    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(mockSync).toHaveBeenCalledWith('P242036')
    expect(res.body.content.results).toEqual([
      { contactCode: 'P242036', status: 'synced' },
    ])
  })

  it.each([
    ['no body', undefined],
    ['no contactCodes', {}],
    ['an empty list', { contactCodes: [] }],
    ['a blank code', { contactCodes: ['P000001', '  '] }],
    ['a non-string code', { contactCodes: [123] }],
  ])('answers 400 for %s without syncing', async (_, body) => {
    const res = await sync(body)

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-request')
    expect(mockSync).not.toHaveBeenCalled()
  })

  it('answers 400 for more codes than one request may sync', async () => {
    const contactCodes = Array.from(
      { length: MAX_SYNC_TO_LEASING_CONTACT_CODES + 1 },
      (_, i) => `P${i}`
    )

    const res = await sync({ contactCodes })

    expect(res.status).toBe(400)
    expect(mockSync).not.toHaveBeenCalled()
  })
})
