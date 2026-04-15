import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../../common/config'
import * as workOrderAdapter from '../../work-order-adapter'
import * as factory from '../../../../test/factories'

const mockServer = setupServer()

describe('work-order-adapter.syncContactToWorkOrder', () => {
  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  it('returns ok on successful sync', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()

    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () => HttpResponse.json({ content: { updatedCount: 2 } })
      )
    )

    const { contactCode, ...contactData } = payload
    const result = await workOrderAdapter.syncContactToWorkOrder(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('returns data.skipped=true when downstream reports skipped', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()

    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () => HttpResponse.json({ content: null, skipped: true })
      )
    )

    const { contactCode, ...contactData } = payload
    const result = await workOrderAdapter.syncContactToWorkOrder(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: true } })
  })

  it('returns sync-failed on non-success status', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()

    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () => HttpResponse.json({ error: 'Bad request' }, { status: 400 })
      )
    )

    const { contactCode, ...contactData } = payload
    const result = await workOrderAdapter.syncContactToWorkOrder(
      contactCode,
      contactData
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
      expect(result.statusCode).toBe(400)
    }
  })

  it('returns unknown on network error', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()

    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () => HttpResponse.error()
      )
    )

    const { contactCode, ...contactData } = payload
    const result = await workOrderAdapter.syncContactToWorkOrder(
      contactCode,
      contactData
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})
