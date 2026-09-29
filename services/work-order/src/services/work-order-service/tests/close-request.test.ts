import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'

// Stands in for Odoo's XML-RPC endpoint. The route and the adapter above it are
// the real ones, so this covers how an Odoo refusal becomes the status core
// sees.
const odooMock = {
  connect: jest.fn(),
  execute_kw: jest.fn(),
}

jest.mock('odoo-await', () => {
  return jest.fn().mockImplementation(() => odooMock)
})

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  generateRouteMetadata: jest.fn(() => ({})),
}))

import { routes } from '../index'

// What the xmlrpc client rejects with when Odoo answers with a fault. On
// /xmlrpc/2, Odoo sends a UserError as fault code 2 with str(e) as faultString.
const xmlRpcFault = (faultString: string) =>
  Object.assign(new Error(`XML-RPC fault: ${faultString}`), {
    faultCode: 2,
    faultString,
  })

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('POST /workOrders/:workOrderId/close-request against Odoo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    odooMock.connect.mockResolvedValue(undefined)
    odooMock.execute_kw.mockResolvedValue(true)
  })

  it('calls request_close_from_tenant without a reason when the body has none', async () => {
    const res = await request(app.callback()).post(
      '/api/workOrders/13/close-request'
    )

    expect(res.status).toBe(200)
    expect(odooMock.execute_kw).toHaveBeenCalledWith(
      'maintenance.request',
      'request_close_from_tenant',
      [[13], {}]
    )
  })

  it('calls request_close_from_tenant with the reason from the body', async () => {
    const res = await request(app.callback())
      .post('/api/workOrders/13/close-request')
      .send({ reason: 'Det fungerar igen' })

    expect(res.status).toBe(200)
    expect(odooMock.execute_kw).toHaveBeenCalledWith(
      'maintenance.request',
      'request_close_from_tenant',
      [[13], { reason: 'Det fungerar igen' }]
    )
  })

  it('answers 409, not 500, when Odoo refuses with a close_request_conflict fault', async () => {
    odooMock.execute_kw.mockRejectedValue(
      xmlRpcFault(
        'close_request_conflict:already_pending Det finns redan en begäran.'
      )
    )

    const res = await request(app.callback()).post(
      '/api/workOrders/13/close-request'
    )

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'close-request-conflict',
      reason: 'already_pending',
    })
  })

  it('answers 500 for any other Odoo fault', async () => {
    odooMock.execute_kw.mockRejectedValue(
      xmlRpcFault(
        'Traceback (most recent call last):\npsycopg2.errors.SerializationFailure'
      )
    )

    const res = await request(app.callback()).post(
      '/api/workOrders/13/close-request'
    )

    expect(res.status).toBe(500)
  })

  it('answers 500 when Odoo cannot be reached', async () => {
    odooMock.connect.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:8069')
    )

    const res = await request(app.callback()).post(
      '/api/workOrders/13/close-request'
    )

    expect(res.status).toBe(500)
    expect(odooMock.execute_kw).not.toHaveBeenCalled()
  })

  it('answers 400 and does not call Odoo when the reason is not a string', async () => {
    const res = await request(app.callback())
      .post('/api/workOrders/13/close-request')
      .send({ reason: 42 })

    expect(res.status).toBe(400)
    expect(odooMock.execute_kw).not.toHaveBeenCalled()
  })
})
