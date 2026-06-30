import axios from 'axios'
jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
    loggedAxios: axios,
    axiosTypes: axios,
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
// Spy on the source module rather than the communication-adapter barrel: the
// barrel re-exports forwardDeliveryReport via `export * from`, whose getter is
// non-configurable and cannot be redefined by jest.spyOn. The barrel reads the
// live binding, so spying here still intercepts the route's call.
import * as deliveryReports from '../../../adapters/communication-adapter/delivery-reports'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('communication-service index', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  describe('POST /webhooks/infobip', () => {
    const report = {
      results: [{ messageId: 'abc-123', status: { groupName: 'DELIVERED' } }],
    }

    it('forwards the report body to the communication service and returns 200', async () => {
      const forwardSpy = jest
        .spyOn(deliveryReports, 'forwardDeliveryReport')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback())
        .post('/webhooks/infobip')
        .send(report)

      expect(res.status).toBe(200)
      expect(forwardSpy).toHaveBeenCalledWith(report)
    })

    it('maps an adapter failure to its status code', async () => {
      const forwardSpy = jest
        .spyOn(deliveryReports, 'forwardDeliveryReport')
        .mockResolvedValue({ ok: false, err: 'error', statusCode: 502 })

      const res = await request(app.callback())
        .post('/webhooks/infobip')
        .send(report)

      expect(res.status).toBe(502)
      expect(res.body.error).toBe('error')
      expect(forwardSpy).toHaveBeenCalledWith(report)
    })

    it('falls back to 500 when the adapter failure has no status code', async () => {
      jest
        .spyOn(deliveryReports, 'forwardDeliveryReport')
        .mockResolvedValue({ ok: false, err: 'error' })

      const res = await request(app.callback())
        .post('/webhooks/infobip')
        .send(report)

      expect(res.status).toBe(500)
    })
  })
})
