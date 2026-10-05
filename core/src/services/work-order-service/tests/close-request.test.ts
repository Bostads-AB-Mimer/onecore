import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../../common/config'
import { routes } from '../index'

// Stands in for the work-order service. The core route and adapter are the
// real ones, so this pins how the service's status reaches the .NET API.
const mockServer = setupServer()

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('POST /work-orders/:workOrderId/close-request against the work-order service', () => {
  beforeAll(() => {
    // supertest's own requests to the in-process app must go through untouched
    mockServer.listen({ onUnhandledRequest: 'bypass' })
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  it('answers 409, not 500, when the service reports a close-request conflict', async () => {
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/workOrders/13/close-request`,
        () =>
          HttpResponse.json(
            { error: 'close-request-conflict', reason: 'already_pending' },
            { status: 409 }
          )
      )
    )

    const res = await request(app.callback()).post(
      '/work-orders/13/close-request'
    )

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'close-request-conflict',
      reason: 'already_pending',
    })
  })

  it('answers 400 and does not call the service when the reason is longer than 1000 characters', async () => {
    let called = false
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/workOrders/13/close-request`,
        () => {
          called = true
          return HttpResponse.json({}, { status: 200 })
        }
      )
    )

    const res = await request(app.callback())
      .post('/work-orders/13/close-request')
      .send({ reason: 'a'.repeat(1001) })

    expect(res.status).toBe(400)
    expect(called).toBe(false)
  })

  it('answers 500 when the service fails for any other reason', async () => {
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/workOrders/13/close-request`,
        () =>
          HttpResponse.json(
            { error: 'XML-RPC fault: Traceback' },
            { status: 500 }
          )
      )
    )

    const res = await request(app.callback()).post(
      '/work-orders/13/close-request'
    )

    expect(res.status).toBe(500)
  })

  it('passes the reason through to the service, and nothing when it is omitted', async () => {
    const received: unknown[] = []
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/workOrders/13/close-request`,
        async ({ request }) => {
          received.push(await request.json())
          return HttpResponse.json(
            { message: 'Close requested for work order with ID 13' },
            { status: 200 }
          )
        }
      )
    )

    const withReason = await request(app.callback())
      .post('/work-orders/13/close-request')
      .send({ reason: 'Det fungerar igen' })
    const withoutReason = await request(app.callback()).post(
      '/work-orders/13/close-request'
    )

    expect(withReason.status).toBe(200)
    expect(withoutReason.status).toBe(200)
    expect(received).toEqual([{ reason: 'Det fungerar igen' }, {}])
  })
})
