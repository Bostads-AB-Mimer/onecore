import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import { logOutboundDispatch } from '../adapters/db'

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
  generateRouteMetadata: jest.fn(() => ({})),
}))

jest.mock('../adapters/db', () => ({
  logOutboundDispatch: jest
    .fn()
    .mockResolvedValue({ dispatchId: '00000000-0000-0000-0000-000000000001' }),
  getDispatchById: jest.fn(),
  getCustomerMessages: jest.fn(),
}))

const logOutboundMock = logOutboundDispatch as jest.Mock

const app = new Koa()
const okapi = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(okapi)
app.use(bodyParser())
app.use(okapi.routes())

const postCall = () => request(app.callback()).post('/communication-log/calls')

const validCall = {
  phoneNumber: '070000000',
  contactCode: 'P123456',
  workOrderCode: 'od-123',
  triggeredByUser: 'employee@mimer.nu',
}

beforeEach(() => {
  logOutboundMock.mockClear()
  logOutboundMock.mockResolvedValue({
    dispatchId: '00000000-0000-0000-0000-000000000001',
  })
})

describe('POST /communication-log/calls', () => {
  it('logs a call dispatch and returns the dispatch id', async () => {
    const res = await postCall().send(validCall)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: '00000000-0000-0000-0000-000000000001',
    })
    expect(logOutboundMock).toHaveBeenCalledWith({
      channel: 'call',
      fromAddress: 'Mimer',
      body: 'Telefonsamtal gällande ärende od-123',
      messageType: 'work_order_tenant_call',
      provider: 'odoo',
      triggeredByUser: 'employee@mimer.nu',
      workOrderCode: 'od-123',
      recipients: [
        {
          contactCode: 'P123456',
          toAddress: '070000000',
          status: 'sent',
        },
      ],
    })
  })

  it('accepts a call without triggeredByUser', async () => {
    const { triggeredByUser: _omitted, ...body } = validCall
    const res = await postCall().send(body)

    expect(res.status).toBe(200)
    expect(logOutboundMock).toHaveBeenCalledWith(
      expect.objectContaining({ triggeredByUser: undefined })
    )
  })

  it('rejects a payload missing contactCode', async () => {
    const { contactCode: _omitted, ...body } = validCall
    const res = await postCall().send(body)

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('contactCode')
    expect(logOutboundMock).not.toHaveBeenCalled()
  })

  it('rejects a workOrderCode without the od- prefix', async () => {
    const res = await postCall().send({ ...validCall, workOrderCode: '12345' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('workOrderCode')
    expect(logOutboundMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the db adapter throws', async () => {
    logOutboundMock.mockRejectedValueOnce(new Error('db down'))
    const res = await postCall().send(validCall)

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'db down' })
  })
})
