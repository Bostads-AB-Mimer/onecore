import axios from 'axios'
jest.mock('@onecore/utilities', () => {
  return {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    loggedAxios: axios,
    axiosTypes: axios,
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

// Token must be configured so the auth check is enforced in tests.
jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: {
    infobip: { webhookToken: 'sms-token' },
    communicationService: { url: 'http://localhost:5040' },
  },
}))

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../infobip-sms-webhook'
// Spy on the source module (see note in index.test.ts re: the barrel's getter).
import * as deliveryReports from '../../../adapters/communication-adapter/delivery-reports'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const report = {
  results: [{ messageId: 'abc-123', status: { groupName: 'DELIVERED' } }],
}

describe('POST /webhooks/infobip-sms (SMS token auth)', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('forwards with a valid token and returns 200', async () => {
    const forwardSpy = jest
      .spyOn(deliveryReports, 'forwardDeliveryReport')
      .mockResolvedValue({ ok: true, data: undefined })

    const res = await request(app.callback())
      .post('/webhooks/infobip-sms?token=sms-token')
      .send(report)

    expect(res.status).toBe(200)
    expect(forwardSpy).toHaveBeenCalledWith(report)
  })

  it('rejects a missing token with 401 (no forward)', async () => {
    const forwardSpy = jest.spyOn(deliveryReports, 'forwardDeliveryReport')

    const res = await request(app.callback())
      .post('/webhooks/infobip-sms')
      .send(report)

    expect(res.status).toBe(401)
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  it('rejects a wrong token with 401 (no forward)', async () => {
    const forwardSpy = jest.spyOn(deliveryReports, 'forwardDeliveryReport')

    const res = await request(app.callback())
      .post('/webhooks/infobip-sms?token=wrong-token')
      .send(report)

    expect(res.status).toBe(401)
    expect(forwardSpy).not.toHaveBeenCalled()
  })

  it('maps an adapter failure to its status code', async () => {
    jest
      .spyOn(deliveryReports, 'forwardDeliveryReport')
      .mockResolvedValue({ ok: false, err: 'error', statusCode: 502 })

    const res = await request(app.callback())
      .post('/webhooks/infobip-sms?token=sms-token')
      .send(report)

    expect(res.status).toBe(502)
  })
})
