import { describe, it, expect, vi, afterEach } from 'vitest'

import type { Lease } from '@/services/types'
import { deriveDisplayStatus } from '@/lib/lease-status'

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    leaseId: 'lease-1',
    leaseNumber: '01',
    leaseStartDate: '2025-01-01',
    status: 'Current',
    rentalPropertyId: 'prop-1',
    type: 'Bostadskontrakt',
    tenants: [],
    ...overrides,
  } as Lease
}

describe('deriveDisplayStatus', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns ended when lastDebitDate is in the past', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01'))

    const lease = makeLease({ lastDebitDate: '2025-03-01', status: 'Current' })
    expect(deriveDisplayStatus(lease)).toBe('ended')
  })

  it('returns upcoming when leaseStartDate is in the future', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01'))

    const lease = makeLease({ leaseStartDate: '2025-06-01', status: 'Current' })
    expect(deriveDisplayStatus(lease)).toBe('upcoming')
  })

  it('falls back to backend status when dates do not determine result', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01'))

    // Numeric status 2 → 'ended' via normalizeBackendStatus
    expect(deriveDisplayStatus(makeLease({ status: 2 as any }))).toBe('ended')
    // String "upcoming" → 'upcoming'
    expect(deriveDisplayStatus(makeLease({ status: 'upcoming' as any }))).toBe(
      'upcoming'
    )
    // 'abouttoend' is treated as active (fallthrough)
    expect(
      deriveDisplayStatus(makeLease({ status: 'abouttoend' as any }))
    ).toBe('active')
  })
})
