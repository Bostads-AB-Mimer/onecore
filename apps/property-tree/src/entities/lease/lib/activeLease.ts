import type { LeaseStatusFilter } from '@/services/api/core/leaseSearchService'
import type { Lease } from '@/services/api/core/leaseService'

// Statuses where the tenant still occupies and pays for the object, in order of
// preference. A preliminarily terminated lease (termination awaiting signing or
// confirmation) is still in force, so it ranks ahead of a confirmed termination.
const ACTIVE_LEASE_STATUSES = [
  'Current',
  'PreliminaryTerminated',
  'AboutToEnd',
] as const satisfies readonly Lease['status'][]

// The lease search names each status by its own token. Typed per active
// status, so a status added above does not compile until it has a token here.
const SEARCH_TOKEN_BY_ACTIVE_STATUS: Record<
  (typeof ACTIVE_LEASE_STATUSES)[number],
  LeaseStatusFilter
> = {
  Current: 'current',
  PreliminaryTerminated: 'preliminaryterminated',
  AboutToEnd: 'abouttoend',
}

/** The lease search status filter for the leases findActiveLease counts. */
export const ACTIVE_LEASE_SEARCH_STATUSES: LeaseStatusFilter[] =
  ACTIVE_LEASE_STATUSES.map((status) => SEARCH_TOKEN_BY_ACTIVE_STATUS[status])

/**
 * Picks the lease that is in force for a rental object right now. Upcoming,
 * ended and not-yet-signed leases never count.
 */
export function findActiveLease(
  leases: readonly Lease[] | undefined
): Lease | undefined {
  if (!leases) return undefined

  for (const status of ACTIVE_LEASE_STATUSES) {
    const lease = leases.find((l) => l.status === status)
    if (lease) return lease
  }
  return undefined
}
