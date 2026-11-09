import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import { makeOkapiRouter } from 'koa-okapi-router'
import { TenantNotificationRole } from '@onecore/types'

import { requireRole } from '../../../../middlewares/keycloak-auth'
import { requiredRolesFor } from '../../../../middlewares/route-roles'
import { routes } from '../index'
import { tenantNotificationIdempotencyStore } from '../idempotency'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import { contactsAdapter } from '../../../../adapters/contacts-adapter'
import { Config } from '@/common/config'
import type { Contact } from '@onecore/contacts/schema'

jest.mock('../../../../adapters/communication-adapter')
jest.mock('../../../../adapters/leasing-adapter')
jest.mock('../../../../adapters/contacts-adapter')

const sendMock =
  communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock
const getLeaseMock = leasingAdapter.getLease as jest.Mock
const getContactsMock = contactsAdapter.getByContactCodeBatch as jest.Mock

const individual = (
  contactCode: string,
  firstName: string,
  lastName: string,
  emailAddress: string | null,
  birthDate: string | null = '1985-03-14T00:00:00.000Z'
): Contact => ({
  type: 'individual',
  contactCode,
  contactKey: `_${contactCode}`,
  protectedIdentity: false,
  personal: {
    nationalId: '198503142382',
    birthDate,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
  },
  communication: {
    phoneNumbers: [],
    emailAddresses: emailAddress
      ? [{ emailAddress, type: 'private', isPrimary: true }]
      : [],
    specialAttention: false,
  },
  addresses: [
    {
      street: `${lastName}gatan 1`,
      zipCode: '722 11',
      city: 'Västerås',
      region: null,
      country: null,
      full: null,
    },
  ],
})

const ANNA = individual('P123456', 'Anna', 'Andersson', 'anna@example.com')
const BO = individual('P654321', 'Bo', 'Berg', 'bo@example.com', '1990-07-01')

const lease = (
  tenantContactIds: string[] = ['P123456'],
  overrides: Record<string, unknown> = {}
) => ({
  leaseId: '307-002-11-0201/11',
  tenantContactIds,
  type: 'P-Platskontrakt',
  // JSON from the leasing service: dates arrive as strings.
  leaseEndDate: '2026-10-31T00:00:00.000Z',
  preferredMoveOutDate: '2026-10-15T00:00:00.000Z',
  rentalObject: { address: 'Bilvägen 3 ' },
  ...overrides,
})

const LEASE_TERMINATION_ROLE = TenantNotificationRole.LeaseTermination
const IDEMPOTENCY_KEY = 'tenfast-evt-123'
const LEASE_TERMINATION_PATH =
  '/v1/tenant-notifications/lease-termination-confirmation'

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
app.use((ctx, next) =>
  requireRole(requiredRolesFor(ctx.path, ctx.method))(ctx, next)
)
const koaRouter = new KoaRouter()
const apiRouter = makeOkapiRouter(koaRouter, {
  openapi: { info: { title: 'test' } },
})
routes(apiRouter, {} as Config)
app.use(koaRouter.routes())

const body = (overrides: Record<string, unknown> = {}) => ({
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  leaseId: '307-002-11-0201/11',
  endDate: '2026-10-31',
  rentalType: 'Bilplats' as const,
  ...overrides,
})

const postNotification = (
  payload: Record<string, unknown> = body(),
  idempotencyKey = IDEMPOTENCY_KEY
) =>
  request(app.callback())
    .post(LEASE_TERMINATION_PATH)
    .set('Idempotency-Key', idempotencyKey)
    .send(payload)

beforeEach(() => {
  mockUser = TEST_USER
  tenantNotificationIdempotencyStore.clear()
  sendMock.mockReset().mockResolvedValue({ ok: true, data: null })
  getLeaseMock.mockReset().mockResolvedValue(lease())
  getContactsMock.mockReset().mockResolvedValue({ ok: true, data: [ANNA] })
})

describe('POST /v1/tenant-notifications/lease-termination-confirmation', () => {
  it('sends a lease termination notification and returns sent: true', async () => {
    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ sent: true })
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith({
      to: 'anna@example.com',
      contactCode: 'P123456',
      firstName: 'Anna',
      lastName: 'Andersson',
      leaseId: '307-002-11-0201/11',
      endDate: new Date('2026-10-31T00:00:00.000Z'),
      rentalType: 'Bilplats',
      preferredMoveOutDate: '2026-10-15',
      rentalObjectAddress: 'Bilvägen 3',
      tenants: [
        {
          contactCode: 'P123456',
          fullName: 'Anna Andersson',
          birthDate: '1985-03-14',
          street: 'Anderssongatan 1',
          zipCode: '722 11',
          city: 'Västerås',
        },
      ],
      triggeredByUser: 'Tenfast Integration',
    })
    expect(getContactsMock).toHaveBeenCalledWith(['P123456'], {
      includeEmail: true,
      includeAddress: true,
    })
  })

  it('emails every lease holder, each listing both holders', async () => {
    getLeaseMock.mockResolvedValue(lease(['P123456', 'P654321']))
    getContactsMock.mockResolvedValue({ ok: true, data: [BO, ANNA] })

    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(2)
    const sent = sendMock.mock.calls.map(([email]) => email)
    expect(sent.map((e) => [e.to, e.contactCode, e.firstName])).toEqual([
      ['anna@example.com', 'P123456', 'Anna'],
      ['bo@example.com', 'P654321', 'Bo'],
    ])
    for (const email of sent) {
      // Lease order, regardless of the order contacts returned them in.
      expect(
        email.tenants.map((t: { fullName: string }) => t.fullName)
      ).toEqual(['Anna Andersson', 'Bo Berg'])
    }
    expect(sent[1].tenants[1].birthDate).toBe('1990-07-01')
  })

  it('skips a holder without email but still lists them', async () => {
    getLeaseMock.mockResolvedValue(lease(['P123456', 'P654321']))
    getContactsMock.mockResolvedValue({
      ok: true,
      data: [ANNA, individual('P654321', 'Bo', 'Berg', null)],
    })

    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0].tenants).toHaveLength(2)
  })

  it('ignores recipient fields in the request and uses the lease holders', async () => {
    getLeaseMock.mockResolvedValue(lease(['P654321']))
    getContactsMock.mockResolvedValue({ ok: true, data: [BO] })

    const res = await postNotification(
      body({ to: 'not-an-email', contactCode: 'P123456', firstName: 'Anna' })
    )

    expect(res.status).toBe(200)
    expect(getContactsMock).toHaveBeenCalledWith(['P654321'], expect.anything())
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: 'bo@example.com',
        contactCode: 'P654321',
        firstName: 'Bo',
      })
    )
  })

  it('returns 422 when the lease lists no holders', async () => {
    getLeaseMock.mockResolvedValue(lease([]))

    const res = await postNotification()

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('no-recipient')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns 422 when no holder has an email address', async () => {
    getContactsMock.mockResolvedValue({
      ok: true,
      data: [individual('P123456', 'Anna', 'Andersson', null)],
    })

    const res = await postNotification()

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('no-recipient')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends with only leaseId, reading everything else from the lease', async () => {
    getLeaseMock.mockResolvedValue(
      lease(['P123456'], { leaseEndDate: '2026-11-30T00:00:00.000Z' })
    )

    const res = await postNotification({ leaseId: '307-002-11-0201/11' })

    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'anna@example.com',
        contactCode: 'P123456',
        firstName: 'Anna',
        endDate: new Date('2026-11-30T00:00:00.000Z'),
        rentalType: 'Bilplats',
      })
    )
  })

  it('ignores endDate in the request', async () => {
    getLeaseMock.mockResolvedValue(
      lease(['P123456'], { leaseEndDate: '2026-11-30T00:00:00.000Z' })
    )

    await postNotification(body({ endDate: '2026-10-31' }))

    expect(sendMock.mock.calls[0][0].endDate).toEqual(
      new Date('2026-11-30T00:00:00.000Z')
    )
  })

  it('returns 422 when the lease has no end date, even if the request has one', async () => {
    getLeaseMock.mockResolvedValue(
      lease(['P123456'], { leaseEndDate: undefined })
    )

    const res = await postNotification(body({ endDate: '2026-10-31' }))

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('missing-end-date')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns 422 for a non-parking lease, even if the request says Bilplats', async () => {
    getLeaseMock.mockResolvedValue(
      lease(['P123456'], { type: 'Bostadskontrakt' })
    )

    const res = await postNotification(body({ rentalType: 'Bilplats' }))

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('unsupported-rental-type')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns 400 when leaseId is missing', async () => {
    const res = await postNotification({ endDate: '2026-10-31' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-request')
  })

  it('returns 404 when the lease does not exist', async () => {
    getLeaseMock.mockResolvedValue(null)

    const res = await postNotification()

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('lease-not-found')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns 502 when the lease lookup fails', async () => {
    getLeaseMock.mockRejectedValue(new Error('leasing down'))

    const res = await postNotification()

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('lease-lookup-failed')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('fails closed when the contacts lookup fails', async () => {
    getContactsMock.mockResolvedValue({
      ok: false,
      err: 'unknown',
      statusCode: 500,
    })

    const res = await postNotification()

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('contact-lookup-failed')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('fails closed when a lease holder is missing in contacts', async () => {
    getLeaseMock.mockResolvedValue(lease(['P123456', 'P654321']))

    const res = await postNotification()

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('contact-not-found')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('does not report a recipient as sent when its key is held by another payload', async () => {
    // Left over from an earlier request with the same key but another payload.
    tenantNotificationIdempotencyStore.claim(
      `${IDEMPOTENCY_KEY}#P123456`,
      'other-payload-hash'
    )

    const res = await postNotification()

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('send-failed')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('only resends to the holder whose email failed on retry', async () => {
    getLeaseMock.mockResolvedValue(lease(['P123456', 'P654321']))
    getContactsMock.mockResolvedValue({ ok: true, data: [ANNA, BO] })
    sendMock
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: false, err: 'unknown', statusCode: 500 })
      .mockResolvedValueOnce({ ok: true, data: null })

    expect((await postNotification()).status).toBe(502)
    expect((await postNotification()).status).toBe(200)

    expect(sendMock.mock.calls.map(([email]) => email.contactCode)).toEqual([
      'P123456',
      'P654321',
      'P654321',
    ])
  })

  it('returns 400 when Idempotency-Key is missing', async () => {
    const res = await request(app.callback())
      .post(LEASE_TERMINATION_PATH)
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
    expect(res.body.message).toBe('Insufficient permissions')
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

  it('returns 400 for invalid request fields', async () => {
    const res = await postNotification(body({ leaseId: '' }))

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

    // supertest only sends on .then(), so start the first request now and the
    // second once the first is blocked inside the send.
    const first = postNotification().then((res) => res)
    await new Promise((resolve) => setTimeout(resolve, 10))
    const secondRes = await postNotification()
    releaseSend()
    const firstRes = await first

    expect(firstRes.status).toBe(200)
    // The first request could still have failed, so the second must not
    // claim the email was sent.
    expect(secondRes.status).toBe(409)
    expect(secondRes.body.error).toBe('request-in-progress')
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('releases the key when processing throws, so a retry sends', async () => {
    // An unexpected throw (here from the send adapter) must not leave the
    // request or recipient key in-flight.
    sendMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, data: null })

    expect((await postNotification()).status).toBe(500)

    const retry = await postNotification()
    expect(retry.status).toBe(200)
    expect(retry.body.content).toEqual({ sent: true })
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  it('trims the address and skips a holder whose email is invalid', async () => {
    getLeaseMock.mockResolvedValue(lease(['P123456', 'P654321']))
    getContactsMock.mockResolvedValue({
      ok: true,
      data: [
        individual('P123456', 'Anna', 'Andersson', ' anna@example.com '),
        individual('P654321', 'Bo', 'Berg', 'saknas'),
      ],
    })

    const res = await postNotification()

    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0].to).toBe('anna@example.com')
    // Bo gets no email but is still listed as a holder.
    expect(
      sendMock.mock.calls[0][0].tenants.map(
        (t: { contactCode: string }) => t.contactCode
      )
    ).toEqual(['P123456', 'P654321'])
  })

  it('uses the trimmed contact code when contacts returns a padded one', async () => {
    // Xpand char codes are space-padded.
    getContactsMock.mockResolvedValue({
      ok: true,
      data: [{ ...ANNA, contactCode: 'P123456   ' }],
    })

    expect((await postNotification()).status).toBe(200)
    const [email] = sendMock.mock.calls[0]
    expect(email.contactCode).toBe('P123456')
    expect(email.tenants[0].contactCode).toBe('P123456')
  })

  it('reads lease dates at Swedish midnight as that Swedish date', async () => {
    getLeaseMock.mockResolvedValue(
      lease(['P123456'], {
        // 2026-10-31 00:00 and 2026-10-15 00:00 in Europe/Stockholm.
        leaseEndDate: '2026-10-30T23:00:00.000Z',
        preferredMoveOutDate: '2026-10-14T22:00:00.000Z',
      })
    )

    expect((await postNotification()).status).toBe(200)
    const [email] = sendMock.mock.calls[0]
    expect(email.endDate).toEqual(new Date('2026-10-31T00:00:00.000Z'))
    expect(email.preferredMoveOutDate).toBe('2026-10-15')
  })

  it('treats an unparseable end date as missing', async () => {
    getLeaseMock.mockResolvedValue(
      lease(['P123456'], { leaseEndDate: 'not-a-date' })
    )

    const res = await postNotification()

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('missing-end-date')
    expect(sendMock).not.toHaveBeenCalled()
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
