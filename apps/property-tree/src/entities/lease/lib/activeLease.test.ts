import { describe, expect, it } from 'vitest'

import type { Lease } from '@/services/api/core/leaseService'

import { findActiveLease } from './activeLease'

// Only the fields findActiveLease reads; the cast keeps the fixture small
const lease = (leaseId: string, status: Lease['status']) =>
  ({ leaseId, status }) as Lease

describe('findActiveLease', () => {
  it('returns undefined when there are no leases', () => {
    expect(findActiveLease(undefined)).toBeUndefined()
    expect(findActiveLease([])).toBeUndefined()
  })

  it('returns a preliminarily terminated lease', () => {
    const leases = [lease('01', 'Ended'), lease('02', 'PreliminaryTerminated')]

    expect(findActiveLease(leases)?.leaseId).toBe('02')
  })

  it('returns a lease that is about to end', () => {
    const leases = [lease('01', 'Ended'), lease('02', 'AboutToEnd')]

    expect(findActiveLease(leases)?.leaseId).toBe('02')
  })

  it('prefers the current lease over an upcoming one regardless of order', () => {
    const leases = [lease('02', 'Upcoming'), lease('01', 'Current')]

    expect(findActiveLease(leases)?.leaseId).toBe('01')
  })

  it('prefers Current, then PreliminaryTerminated, then AboutToEnd', () => {
    const aboutToEnd = lease('01', 'AboutToEnd')
    const preliminary = lease('02', 'PreliminaryTerminated')
    const current = lease('03', 'Current')

    expect(findActiveLease([aboutToEnd, preliminary, current])?.leaseId).toBe(
      '03'
    )
    expect(findActiveLease([aboutToEnd, preliminary])?.leaseId).toBe('02')
  })

  it.each(['Upcoming', 'Ended', 'PendingSignature', 'NotSent'] as const)(
    'does not count a %s lease as active',
    (status) => {
      expect(findActiveLease([lease('01', status)])).toBeUndefined()
    }
  )
})
