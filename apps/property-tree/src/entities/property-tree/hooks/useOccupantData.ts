import { skipToken, useQuery } from '@tanstack/react-query'

import { leaseSearchService } from '@/services/api/core/leaseSearchService'
import type {
  RentalObjectSummary,
  RentalObjectType,
} from '@/services/api/core/rentalObjectService'

import { TREE_GC_TIME, TREE_STALE_TIME } from './usePropertyTreeData'

export type { RentalObjectSummary, RentalObjectType }

// The lease search silently clamps limit to 100 (libs/types lease-search),
// so this is the largest page we can ask for.
const PAGE_SIZE = 100

export const RENTAL_OBJECT_GROUP_LABELS: Record<RentalObjectType, string> = {
  residence: 'Bostäder',
  parkingSpace: 'Bilplatser',
  facility: 'Lokaler',
  other: 'Övrigt',
}

export const RENTAL_OBJECT_TYPE_LABELS: Record<RentalObjectType, string> = {
  residence: 'Bostad',
  parkingSpace: 'Bilplats',
  facility: 'Lokal',
  other: 'Övrigt',
}

export interface OccupantTenant {
  contactCode: string
  name: string
}

interface PropertyTenants {
  /** rentalObjectCode → contacts on the current (Gällande) leases. */
  tenantsByCode: Record<string, OccupantTenant[]>
}

/**
 * Pages to completion rather than stopping at a cap: a short read renders
 * occupied objects as "Vakant", and in the målgrupp flow drops them from the
 * audience. Termination is the paging itself — `fetched` only grows, so it
 * reaches totalRecords, and an empty page ends it either way.
 */
async function fetchPropertyTenants(
  designation: string
): Promise<PropertyTenants> {
  const tenantsByCode: Record<string, OccupantTenant[]> = {}
  let fetched = 0
  let page = 1
  for (;;) {
    // Gällande (0) AND uppsagt (2): someone who has given notice still lives
    // there until the lease ends, so the object is occupied, not vakant.
    // Kommande (1) hasn't moved in and upphört (3) has already left.
    const result = await leaseSearchService.search(
      { property: [designation], status: ['0', '2'] },
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
    const total = result._meta.totalRecords ?? 0
    if (fetched >= total || result.content.length === 0) {
      return { tenantsByCode }
    }
    page += 1
  }
}

/** Current tenants for all of a property's objects, keyed by object code.
 * On the tree's TTL: rows mount and unmount as branches open and close, and
 * each miss is one sequential lease page per 100 leases. */
export function usePropertyTenants(designation: string | undefined) {
  return useQuery({
    queryKey: ['propertyTenants', designation],
    queryFn: designation ? () => fetchPropertyTenants(designation) : skipToken,
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })
}
