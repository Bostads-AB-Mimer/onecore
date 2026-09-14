import {
  createInMemoryIdempotencyStore,
  hashNotificationPayload,
} from '../idempotency'

describe('hashNotificationPayload', () => {
  const base = {
    type: 'lease-termination-confirmation' as const,
    to: 'tenant@example.com',
    contactCode: 'P123456',
    firstName: 'Anna',
    address: 'Testgatan 1',
    leaseId: '307-002-11-0201/11',
    endDate: '2026-10-31',
    objectId: '123-456',
    rentalType: 'Bilplats',
  }

  it('ignores server-added triggeredByUser', () => {
    const a = hashNotificationPayload({
      ...base,
      triggeredByUser: 'Tenfast',
    })
    const b = hashNotificationPayload({
      ...base,
      triggeredByUser: 'Other',
    })
    expect(a).toBe(b)
  })

  it('changes when business fields change', () => {
    const a = hashNotificationPayload(base)
    const b = hashNotificationPayload({ ...base, leaseId: 'other-lease' })
    expect(a).not.toBe(b)
  })
})

describe('createInMemoryIdempotencyStore', () => {
  it('returns duplicate for the same key and payload hash', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    expect(store.evaluate('key-1', 'hash-a')).toBe('new')
    store.remember('key-1', 'hash-a')
    expect(store.evaluate('key-1', 'hash-a')).toBe('duplicate')
  })

  it('returns conflict when the key is reused with a different payload', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    store.remember('key-1', 'hash-a')
    expect(store.evaluate('key-1', 'hash-b')).toBe('conflict')
  })
})
