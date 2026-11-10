import { describe, expect, it } from 'vitest'

import type { Lease } from '@/services/api/core/leaseService'

import { buildTenantInfo } from './buildTenantInfo'

// Only the fields buildTenantInfo reads; the cast keeps the fixture small
const lease = (status: Lease['status'], overrides: Partial<Lease> = {}) =>
  ({
    leaseId: '924-715-00-0005/03',
    status,
    leaseStartDate: '2024-01-01',
    tenants: [{ contactCode: 'P226686', fullName: 'Test Tenant' }],
    ...overrides,
  }) as Lease

describe('buildTenantInfo', () => {
  it('returns undefined without a lease or a tenant', () => {
    expect(buildTenantInfo(undefined)).toBeUndefined()
    expect(buildTenantInfo(lease('Current', { tenants: [] }))).toBeUndefined()
  })

  it('maps tenant and lease dates', () => {
    const info = buildTenantInfo(
      lease('Current', { leaseEndDate: '2026-12-31' })
    )

    expect(info).toEqual({
      contactCode: 'P226686',
      fullName: 'Test Tenant',
      moveInDate: '2024-01-01',
      moveOutDate: '2026-12-31',
      termination: undefined,
    })
  })

  it('marks a lease that is about to end as a confirmed termination', () => {
    expect(buildTenantInfo(lease('AboutToEnd'))?.termination).toBe('confirmed')
  })

  it('marks a preliminarily terminated lease as a preliminary termination', () => {
    const info = buildTenantInfo(
      lease('PreliminaryTerminated', { preferredMoveOutDate: '2026-12-01' })
    )

    expect(info?.termination).toBe('preliminary')
    expect(info?.moveOutDate).toBe('2026-12-01')
  })

  it.each(['Current', 'Upcoming', 'Ended'] as const)(
    'does not mark a %s lease as terminated',
    (status) => {
      expect(buildTenantInfo(lease(status))?.termination).toBeUndefined()
    }
  )
})
