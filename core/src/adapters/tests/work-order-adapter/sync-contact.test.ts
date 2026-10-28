import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { logger } from '@onecore/utilities'

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

  it('passes the undo object through', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()
    const undo = {
      tenants: [
        {
          id: 1,
          fullName: 'Gammal, Namn',
          emailAddress: null,
          phoneNumber: null,
        },
      ],
    }
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () =>
          HttpResponse.json({
            content: { updatedCount: 1 },
            skipped: false,
            undo,
          })
      )
    )

    const { contactCode, ...contactData } = payload
    const result = await workOrderAdapter.syncContactToWorkOrder(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: false, undo } })
  })

  it('leaves out an undo that does not match the schema', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () =>
          HttpResponse.json({
            content: { updatedCount: 1 },
            skipped: false,
            undo: { tenants: [{ id: 'one' }] },
          })
      )
    )

    const { contactCode, ...contactData } = payload
    const result = await workOrderAdapter.syncContactToWorkOrder(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('bounds the call so a hung work-order service fails within a few minutes', async () => {
    const payload = factory.syncContactToWorkOrderPayload.build()

    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/${payload.contactCode}/sync`,
        () => HttpResponse.json({ content: { updatedCount: 1 } })
      )
    )
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')

    const { contactCode, ...contactData } = payload
    await workOrderAdapter.syncContactToWorkOrder(contactCode, contactData)

    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    const ms = timeoutSpy.mock.calls[0][0]
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(5 * 60_000)
    timeoutSpy.mockRestore()
  })
})

describe('work-order-adapter.undoContactSyncInWorkOrder', () => {
  beforeAll(() => mockServer.listen())
  afterEach(() => mockServer.resetHandlers())
  afterAll(() => mockServer.close())

  const undo = {
    tenants: [
      {
        id: 1,
        fullName: 'Gammal, Namn',
        emailAddress: 'g@test.se',
        phoneNumber: null,
      },
    ],
  }

  it('posts the undo object and returns ok', async () => {
    let body: unknown
    mockServer.use(
      http.post(
        `${config.workOrderService.url}/contacts/P1/undo-sync`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ content: { restored: [1], missing: [] } })
        }
      )
    )

    const result = await workOrderAdapter.undoContactSyncInWorkOrder('P1', undo)

    expect(body).toEqual(undo)
    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns undo-failed with the status on a 4xx or 5xx', async () => {
    mockServer.use(
      http.post(`${config.workOrderService.url}/contacts/P1/undo-sync`, () =>
        HttpResponse.json({ error: 'foreign-tenant' }, { status: 400 })
      )
    )

    const result = await workOrderAdapter.undoContactSyncInWorkOrder('P1', undo)

    expect(result).toEqual({ ok: false, err: 'undo-failed', statusCode: 400 })
  })

  it('returns unknown on a network error and logs no contact values', async () => {
    mockServer.use(
      http.post(`${config.workOrderService.url}/contacts/P1/undo-sync`, () =>
        HttpResponse.error()
      )
    )
    const errorSpy = jest.spyOn(logger, 'error')

    const result = await workOrderAdapter.undoContactSyncInWorkOrder('P1', undo)

    expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('g@test.se')
    errorSpy.mockRestore()
  })

  it('bounds the call so a hung work-order service fails within a few minutes', async () => {
    mockServer.use(
      http.post(`${config.workOrderService.url}/contacts/P1/undo-sync`, () =>
        HttpResponse.json({ content: { restored: [1], missing: [] } })
      )
    )
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')

    await workOrderAdapter.undoContactSyncInWorkOrder('P1', undo)

    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    const ms = timeoutSpy.mock.calls[0][0]
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(5 * 60_000)
    timeoutSpy.mockRestore()
  })

  it('logs the network error message', async () => {
    mockServer.use(
      http.post(`${config.workOrderService.url}/contacts/P1/undo-sync`, () =>
        HttpResponse.error()
      )
    )
    const errorSpy = jest.spyOn(logger, 'error')

    await workOrderAdapter.undoContactSyncInWorkOrder('P1', undo)

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCode: 'P1',
        message: expect.stringMatching(/\S/),
      }),
      'work-order-adapter.undoContactSyncInWorkOrder'
    )
    errorSpy.mockRestore()
  })
})
