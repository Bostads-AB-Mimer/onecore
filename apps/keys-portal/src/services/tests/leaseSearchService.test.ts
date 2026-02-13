import { describe, it, expect, vi } from 'vitest'

import type { Lease } from '@/services/types'

vi.mock('../api/core/base-api', () => ({
  GET: vi.fn(),
}))

import { dedupeLeases, equalPnr } from '../api/leaseSearchService'

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    leaseId: 'prop-1/01',
    leaseNumber: '01',
    leaseStartDate: '2025-01-01',
    status: 'Current',
    rentalPropertyId: 'prop-1',
    type: 'Bostadskontrakt',
    tenants: [],
    ...overrides,
  } as Lease
}

describe('dedupeLeases', () => {
  it('removes duplicate leases by leaseId', () => {
    const leases = [
      makeLease({ leaseId: 'prop-1/01' }),
      makeLease({ leaseId: 'prop-1/01' }),
      makeLease({ leaseId: 'prop-2/01' }),
    ]

    const result = dedupeLeases(leases)

    expect(result).toHaveLength(2)
    expect(result[0].leaseId).toBe('prop-1/01')
    expect(result[1].leaseId).toBe('prop-2/01')
  })

  it('falls back to rentalPropertyId/leaseNumber composite key when leaseId is missing', () => {
    const leases = [
      makeLease({
        leaseId: undefined,
        rentalPropertyId: 'prop-1',
        leaseNumber: '01',
      }),
      makeLease({
        leaseId: undefined,
        rentalPropertyId: 'prop-1',
        leaseNumber: '01',
      }),
      makeLease({
        leaseId: undefined,
        rentalPropertyId: 'prop-1',
        leaseNumber: '02',
      }),
    ]

    const result = dedupeLeases(leases)

    expect(result).toHaveLength(2)
    expect(result[0].leaseNumber).toBe('01')
    expect(result[1].leaseNumber).toBe('02')
  })
})

describe('equalPnr', () => {
  it('matches 12-digit and 10-digit PNR by comparing last 10 digits', () => {
    expect(equalPnr('200001011234', '0001011234')).toBe(true)
    expect(equalPnr('19900101-1234', '9001011234')).toBe(true)
    expect(equalPnr('0001011234', '0001019999')).toBe(false)
  })
})
