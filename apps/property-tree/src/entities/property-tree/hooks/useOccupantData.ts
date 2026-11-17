import { skipToken, useQuery } from '@tanstack/react-query'

import { ACTIVE_LEASE_SEARCH_STATUSES } from '@/entities/lease'

import { leaseSearchService } from '@/services/api/core/leaseSearchService'
import type {
  RentalObjectSummary,
  RentalObjectType,
} from '@/services/api/core/rentalObjectService'

import { TREE_GC_TIME, TREE_STALE_TIME } from './usePropertyTreeData'

export type { RentalObjectSummary, RentalObjectType }

// The lease search silently clamps limit to 500 (libs/types lease-search),
// so this is the largest page we can ask for. A property with fewer matching
// leases is read in one request, with no page boundary to lose a lease at.
const PAGE_SIZE = 500

export interface OccupantTenant {
  contactCode: string
  name: string
}

interface PropertyTenants {
  /** rentalObjectCode → the tenants who rent the object now. */
  tenantsByCode: Record<string, OccupantTenant[]>
}

/**
 * Pages to completion rather than stopping at a cap: a short read renders
 * occupied objects as "Vakant", and in the målgrupp flow drops them from the
 * audience. Termination is the paging itself — `fetched` only grows, so it
 * reaches totalRecords, and an empty page ends it either way.
 */
export async function fetchPropertyTenants(
  designation: string
): Promise<PropertyTenants> {
  const tenantsByCode: Record<string, OccupantTenant[]> = {}
  let fetched = 0
  let page = 1
  for (;;) {
    // The same leases the object pages count as active: a tenant under notice,
    // confirmed or not, still lives there until the lease ends, so the object
    // is occupied, not vacant. An upcoming tenant hasn't moved in and an ended
    // lease's tenant has already left.
    const result = await leaseSearchService.search(
      { property: [designation], status: ACTIVE_LEASE_SEARCH_STATUSES },
      page,
      PAGE_SIZE
    )
    fetched += result.content.length
    for (const lease of result.content) {
      if (!lease.rentalObjectCode) continue
      const tenants = (tenantsByCode[lease.rentalObjectCode] ??= [])
      for (const contact of lease.contacts) {
        // contactCode can be empty in Xpand data; dedupe on name as fallback.
        if (!contact.contactCode && !contact.name) continue
        const id = contact.contactCode || contact.name
        if (!tenants.some((t) => (t.contactCode || t.name) === id)) {
          tenants.push({ contactCode: contact.contactCode, name: contact.name })
        }
      }
    }
    // Unknown total pages until an empty page: ?? 0 would end after page one.
    const total = result._meta.totalRecords ?? Infinity
    if (fetched >= total || result.content.length === 0) {
      return { tenantsByCode }
    }
    page += 1
  }
}

/** Current tenants for all of a property's objects, keyed by object code.
 * On the tree's TTL: rows mount and unmount as branches open and close, and
 * each miss is one sequential lease page per 500 leases. */
export function usePropertyTenants(designation: string | undefined) {
  return useQuery({
    queryKey: ['propertyTenants', designation],
    queryFn: designation ? () => fetchPropertyTenants(designation) : skipToken,
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })
}
