import { leasing, LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import * as tenfastLeaseSearchAdapter from '../adapters/tenfast/tenfast-lease-search-adapter'
import { calculateLeaseStatus } from '../helpers/tenfast'

export type LeaseStatusesDeps = {
  // The leases of the lease cache, or undefined while it loads.
  cachedLeases: () => Promise<
    { leaseId: string; status: LeaseStatus }[] | undefined
  >
  getLeaseByLeaseId: typeof tenfastAdapter.getLeaseByLeaseId
}

// Called through the modules, so a test can replace an adapter function.
const defaultDeps: LeaseStatusesDeps = {
  cachedLeases: () => tenfastLeaseSearchAdapter.readFreshLeaseCache(),
  getLeaseByLeaseId: (leaseId) => tenfastAdapter.getLeaseByLeaseId(leaseId),
}

// Lookups of leases not in the cache made at once.
const LOOKUP_CONCURRENCY = 10

// Lease IDs may differ in case and padding between systems.
const leaseKey = (leaseId: string) => leaseId.trim().toUpperCase()

/**
 * The status of each lease, in one read of the lease cache rather than one
 * Tenfast call per lease. The cache leaves out archived leases, so a lease it
 * does not hold is read from Tenfast, a few at a time.
 *
 * Fails with upstream-failed when any of those reads fails, rather than
 * leaving the lease out: a caller could not tell it from a lease that does
 * not exist. A lease Tenfast does not have is listed in notFoundLeaseIds.
 */
export const getLeaseStatuses = async (
  leaseIds: string[],
  deps: LeaseStatusesDeps = defaultDeps
): Promise<
  | { ok: true; data: leasing.LeaseStatusesResponse }
  | { ok: false; err: leasing.LeaseStatusesErrorCode }
> => {
  const requested = [...new Set(leaseIds)]
  if (requested.length === 0) {
    return { ok: true, data: { statuses: [], notFoundLeaseIds: [] } }
  }

  const cached = await deps.cachedLeases()
  if (!cached) return { ok: false, err: 'cache-warming' }

  const statusByKey = new Map(
    cached.map((lease) => [leaseKey(lease.leaseId), lease.status] as const)
  )

  const statuses: leasing.LeaseStatusItem[] = []
  const missing: string[] = []
  for (const leaseId of requested) {
    const status = statusByKey.get(leaseKey(leaseId))
    if (status === undefined) missing.push(leaseId)
    else statuses.push({ leaseId, status })
  }

  const notFoundLeaseIds: string[] = []
  const failedLeaseIds: string[] = []
  for (let i = 0; i < missing.length; i += LOOKUP_CONCURRENCY) {
    const chunk = missing.slice(i, i + LOOKUP_CONCURRENCY)
    const results = await Promise.all(
      chunk.map((leaseId) => deps.getLeaseByLeaseId(leaseId))
    )
    results.forEach((result, index) => {
      const leaseId = chunk[index]
      if (result.ok) {
        statuses.push({ leaseId, status: calculateLeaseStatus(result.data) })
      } else if (result.err === 'not-found') {
        notFoundLeaseIds.push(leaseId)
      } else {
        failedLeaseIds.push(leaseId)
      }
    })
  }

  if (failedLeaseIds.length > 0) {
    // Lease IDs only, no tenant data. The adapter has logged each failure.
    logger.error(
      {
        requested: requested.length,
        fromCache: requested.length - missing.length,
        failed: failedLeaseIds.length,
        failedLeaseIds,
      },
      'getLeaseStatuses: leases could not be read from Tenfast'
    )
    return { ok: false, err: 'upstream-failed' }
  }

  return { ok: true, data: { statuses, notFoundLeaseIds } }
}
