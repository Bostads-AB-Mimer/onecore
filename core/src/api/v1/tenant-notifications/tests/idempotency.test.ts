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
    endDate: new Date('2026-10-31'),
    objectId: '123-456',
    rentalType: 'Bilplats' as const,
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
  it('claims a new key synchronously', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    expect(store.claim('key-1', 'hash-a')).toBe('claimed')
  })

  it('returns duplicate after a successful claim', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    expect(store.claim('key-1', 'hash-a')).toBe('claimed')
    store.markSucceeded('key-1', 'hash-a')
    expect(store.claim('key-1', 'hash-a')).toBe('duplicate')
  })

  it('returns in-flight when the same key is claimed while a send is pending', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    expect(store.claim('key-1', 'hash-a')).toBe('claimed')
    expect(store.claim('key-1', 'hash-a')).toBe('in-flight')
  })

  it('returns conflict when the key is reused with a different payload', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    expect(store.claim('key-1', 'hash-a')).toBe('claimed')
    expect(store.claim('key-1', 'hash-b')).toBe('conflict')
  })

  it('allows reclaim after release on send failure', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    expect(store.claim('key-1', 'hash-a')).toBe('claimed')
    store.release('key-1', 'hash-a')
    expect(store.claim('key-1', 'hash-a')).toBe('claimed')
  })
})
