import { TenantNotificationRole } from '@onecore/types'

import * as communicationAdapter from '../../../../adapters/communication-adapter'
import { createInMemoryIdempotencyStore } from '../idempotency'
import {
  clearInFlightOperations,
  sendTenantNotification,
} from '../send-notification'

jest.mock('../../../../adapters/communication-adapter')

const notification = {
  type: 'lease-termination-confirmation' as const,
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  address: 'Testgatan 1',
  leaseId: '307-002-11-0201/11',
  endDate: new Date('2026-10-31'),
  objectId: '123-456',
  rentalType: 'Bilplats' as const,
}

const ctx = {
  state: {
    user: {
      realm_access: { roles: [TenantNotificationRole.LeaseTermination] },
    },
  },
} as Parameters<typeof sendTenantNotification>[0]

beforeEach(() => {
  clearInFlightOperations()
  ;(communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock)
    .mockReset()
    .mockResolvedValue({ ok: true, data: null })
})

describe('sendTenantNotification in-flight coalescing', () => {
  it('returns send-failed for concurrent waiters when the in-flight send fails', async () => {
    const store = createInMemoryIdempotencyStore(60_000)
    let releaseSend!: () => void
    const sendBlocked = new Promise<void>((resolve) => {
      releaseSend = resolve
    })

    ;(
      communicationAdapter.sendLeaseTerminationConfirmationEmail as jest.Mock
    ).mockImplementationOnce(async () => {
      await sendBlocked
      return { ok: false, err: 'unknown', statusCode: 500 }
    })

    const first = sendTenantNotification(ctx, notification, 'key-1', store)
    const second = sendTenantNotification(ctx, notification, 'key-1', store)

    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
    releaseSend()

    expect(await first).toEqual({ ok: false, error: 'send-failed' })
    expect(await second).toEqual({ ok: false, error: 'send-failed' })
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })

  it('returns duplicate for concurrent waiters when the in-flight send succeeds', async () => {
    const store = createInMemoryIdempotencyStore(60_000)
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

    const first = sendTenantNotification(ctx, notification, 'key-1', store)
    const second = sendTenantNotification(ctx, notification, 'key-1', store)

    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
    releaseSend()

    expect(await first).toEqual({ ok: true, duplicate: false })
    expect(await second).toEqual({ ok: true, duplicate: true })
    expect(
      communicationAdapter.sendLeaseTerminationConfirmationEmail
    ).toHaveBeenCalledTimes(1)
  })
})
