import type { Lease } from '@/services/api/core/leaseService'

// Statuses where the tenant still occupies and pays for the object, in order of
// preference. A preliminarily terminated lease (termination awaiting signing or
// confirmation) is still in force, so it ranks ahead of a confirmed termination.
const ACTIVE_LEASE_STATUSES = [
  'Current',
  'PreliminaryTerminated',
  'AboutToEnd',
] as const satisfies readonly Lease['status'][]

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
