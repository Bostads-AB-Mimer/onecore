import {
  createInMemoryIdempotencyStore,
  hashNotificationPayload,
} from '../idempotency'

describe('hashNotificationPayload', () => {
  const base = {
    leaseId: '307-002-11-0201/11',
    correlationId: 'corr-1',
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

  it('returns the summary stored with a succeeded key', () => {
    const store = createInMemoryIdempotencyStore(60_000)
    const summary = { sentCount: 1, skippedContactCodes: ['P654321'] }
    store.claim('key-1', 'hash-a')
    expect(store.getSummary('key-1', 'hash-a')).toBeUndefined()
    store.markSucceeded('key-1', 'hash-a', summary)
    expect(store.getSummary('key-1', 'hash-a')).toEqual(summary)
    expect(store.getSummary('key-1', 'hash-b')).toBeUndefined()
  })
})
