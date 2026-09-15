import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import { makeOkapiRouter } from 'koa-okapi-router'
import { TenantNotificationRole } from '@onecore/types'

import { routes } from '../index'
import { tenantNotificationIdempotencyStore } from '../idempotency'
import { clearInFlightOperations } from '../send-notification'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import { Config } from '@/common/config'

jest.mock('../../../../adapters/communication-adapter')

const LEASE_TERMINATION_ROLE = TenantNotificationRole.LeaseTermination
const IDEMPOTENCY_KEY = 'tenfast-evt-123'

type TestUser = {
  name: string
  preferred_username: string
  realm_access: { roles: string[] }
}

const TEST_USER: TestUser = {
  name: 'Tenfast Integration',
  preferred_username: 'tenfast-service',
  realm_access: { roles: [LEASE_TERMINATION_ROLE] },
}

let mockUser: TestUser | undefined = TEST_USER

const app = new Koa()
app.use(bodyParser())
app.use((ctx, next) => {
  ctx.state.user = mockUser
  return next()
})
const koaRouter = new KoaRouter()
const apiRouter = makeOkapiRouter(koaRouter, {
  openapi: { info: { title: 'test' } },
})
routes(apiRouter, {} as Config)
app.use(koaRouter.routes())

const body = (overrides: Record<string, unknown> = {}) => ({
  type: 'lease-termination-confirmation',
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  address: 'Testgatan 1',
  leaseId: '307-002-11-0201/11',
  endDate: '2026-10-31',
  objectId: '123-456',
  rentalType: 'Bilplats' as const,
  parkingSpaceId: '123-456-789',
  ...overrides,
})

const postNotification = (
  payload: Record<string, unknown> = body(),
  idempotencyKey = IDEMPOTENCY_KEY
) =>
  request(app.callback())
    .post('/v1/tenant-notifications')
    .set('Idempotency-Key', idempotencyKey)
    .send(payload)

beforeEach(() => {
  mockUser = TEST_USER
  tenantNotificationIdempotencyStore.clear()
  clearInFlightOperations()
  ;(communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock)
    .mockReset()
    .mockResolvedValue({ ok: true, data: null })
})

describe('POST /v1/tenant-notifications', () => {
  it('sends a lease termination notification and returns sent: true', async () => {
    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ sent: true })
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when Idempotency-Key is missing', async () => {
    const res = await request(app.callback())
      .post('/v1/tenant-notifications')
      .send(body())

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing-idempotency-key')
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).not.toHaveBeenCalled()
  })

  it('allows api-access without the type-specific role', async () => {
    mockUser = {
      ...TEST_USER,
      realm_access: { roles: ['api-access'] },
    }

    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ sent: true })
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when the caller lacks api-access and the type-specific role', async () => {
    mockUser = {
      ...TEST_USER,
      realm_access: { roles: ['some-other-role'] },
    }

    const res = await postNotification()

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('insufficient-permissions')
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).not.toHaveBeenCalled()
  })

  it('does not send again when the same Idempotency-Key is retried', async () => {
    await postNotification()
    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ sent: true })
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('returns 409 when Idempotency-Key is reused with a different payload', async () => {
    await postNotification()
    const res = await postNotification(body({ leaseId: 'other-lease' }))

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('idempotency-conflict')
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('returns 400 for an unknown notification type', async () => {
    const res = await postNotification(body({ type: 'not-a-real-type' }))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-request')
  })

  it('returns 502 when the communication service fails', async () => {
    ;(
      communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock
    ).mockResolvedValue({ ok: false, err: 'unknown', statusCode: 500 })

    const res = await postNotification()

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('send-failed')
  })

  it('does not send twice when concurrent requests share an Idempotency-Key', async () => {
    let releaseSend!: () => void
    const sendBlocked = new Promise<void>((resolve) => {
      releaseSend = resolve
    })
    ;(
      communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock
    ).mockImplementationOnce(async () => {
      await sendBlocked
      return { ok: true, data: null }
    })

    const first = postNotification()
    const second = postNotification()

    await new Promise((resolve) => setTimeout(resolve, 10))
    releaseSend()

    const [firstRes, secondRes] = await Promise.all([first, second])

    expect(firstRes.status).toBe(200)
    expect(secondRes.status).toBe(200)
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('allows retry after a failed send with the same Idempotency-Key', async () => {
    ;(communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock)
      .mockResolvedValueOnce({ ok: false, err: 'unknown', statusCode: 500 })
      .mockResolvedValueOnce({ ok: true, data: null })

    expect((await postNotification()).status).toBe(502)
    expect((await postNotification()).status).toBe(200)
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(2)
  })
})
