import { errorMessage, logger } from '@onecore/utilities'
import { LeaseStatus, leasing } from '@onecore/types'

import * as leasingAdapter from '../../../adapters/leasing-adapter'

type LeaseSearchResult = leasing.v1.LeaseSearchResult

// Leases a tenant may still live in. A notice that waits for signing counts as
// under notice: the tenant has chosen to move out (decided with Mimer, AVTAL-511).
export const CSC_LEASE_STATUSES = [
  LeaseStatus.Current,
  LeaseStatus.AboutToEnd,
  LeaseStatus.PreliminaryTerminated,
]

// The day in Sweden as YYYY-MM-DD. Lease dates are Swedish midnight (e.g.
// 2026-11-29T23:00Z for 30 November) and core runs in UTC, so dates are
// compared as Swedish days.
const toSwedishDay = (date: Date | string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(
    new Date(date)
  )

const isUnderNotice = (lease: LeaseSearchResult) =>
  lease.status === LeaseStatus.AboutToEnd ||
  lease.status === LeaseStatus.PreliminaryTerminated

// A lease whose end date is today still counts: the tenant lives there until
// the end of that day.
export const hasLeaseEnded = (lease: LeaseSearchResult, now: Date) =>
  lease.endDate != null && toSwedishDay(lease.endDate) < toSwedishDay(now)

const hasLeaseStarted = (lease: LeaseSearchResult, now: Date) =>
  lease.startDate != null && toSwedishDay(lease.startDate) <= toSwedishDay(now)

const startsLaterThan = (other: LeaseSearchResult, lease: LeaseSearchResult) =>
  other.startDate != null &&
  lease.startDate != null &&
  toSwedishDay(other.startDate) > toSwedishDay(lease.startDate)

/**
 * On an internal move the tenant has the old lease under notice and a new one.
 * AktivBo gets only the lease the tenant is assumed to live in: the one that
 * has started most recently. Returns true for a lease under notice when the
 * tenant has another housing lease of their own that has started later and
 * not ended.
 *
 * The tenant's leases can be on other pages of the CSC list, so they are
 * looked up separately, one search per lease under notice. Those are a small
 * part of a page and leasing answers the search from its cache. If the lookup
 * fails the lease is kept: the tenant may then be sent twice, but is never
 * left out.
 */
export const hasMovedToNewerLease = async (
  lease: LeaseSearchResult,
  contactCode: string,
  now: Date
): Promise<boolean> => {
  if (!isUnderNotice(lease)) return false

  try {
    // q matches parts of contact codes too, so the result is filtered on the
    // exact code below. A tenant has far fewer than 500 leases.
    const result = await leasingAdapter.searchLeases({
      q: contactCode,
      objectType: 'bostad',
      status: CSC_LEASE_STATUSES.map((status) => LeaseStatus[status]),
      limit: '500',
    })

    return (result.content ?? []).some(
      (other) =>
        other.leaseId !== lease.leaseId &&
        // A lease the tenant only sublets is reported under its first-hand
        // tenant, so it doesn't count as the tenant's new home.
        other.contacts.some(
          (contact) =>
            contact.contactCode === contactCode &&
            contact.contactType !== 'subletTenant'
        ) &&
        hasLeaseStarted(other, now) &&
        !hasLeaseEnded(other, now) &&
        startsLaterThan(other, lease)
    )
  } catch (err: unknown) {
    logger.error(
      { leaseId: lease.leaseId, error: errorMessage(err) },
      "for-csc: could not look up the tenant's other leases, keeping the lease"
    )
    return false
  }
}
