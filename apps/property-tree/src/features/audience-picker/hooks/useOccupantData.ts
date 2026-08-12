import { useQuery } from '@tanstack/react-query'

import { leaseSearchService } from '@/services/api/core/leaseSearchService'
import type {
  RentalObjectSummary,
  RentalObjectType,
} from '@/services/api/core/rentalObjectService'
import { rentalObjectService } from '@/services/api/core/rentalObjectService'

export type { RentalObjectSummary, RentalObjectType }

// Lease search caps limit at 100 per page; fetch up to MAX_PAGES per property
// and surface a truncation note beyond that.
const PAGE_SIZE = 100
const MAX_PAGES = 5

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

/**
 * Structure-first occupant data: every rental object of one property from the
 * babuf-backed /rental-objects endpoint. Objects define the tree; leases only
 * decorate it with tenants (usePropertyTenants).
 */
export function usePropertyRentalObjects(propertyCode: string | undefined) {
  return useQuery({
    queryKey: ['audienceRentalObjects', propertyCode],
    queryFn: () =>
      rentalObjectService.getByPropertyCode(propertyCode as string),
    enabled: !!propertyCode,
  })
}

export interface OccupantTenant {
  contactCode: string
  name: string
}

interface PropertyTenants {
  /** rentalObjectCode → contacts on the current (Gällande) leases. */
  tenantsByCode: Record<string, OccupantTenant[]>
  truncated: boolean
}

async function fetchPropertyTenants(
  designation: string
): Promise<PropertyTenants> {
  const tenantsByCode: Record<string, OccupantTenant[]> = {}
  let fetched = 0
  let page = 1
  for (;;) {
    const result = await leaseSearchService.search(
      { property: [designation], status: ['0'] },
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
      return { tenantsByCode, truncated: false }
    }
    if (page >= MAX_PAGES) return { tenantsByCode, truncated: true }
    page += 1
  }
}

/** Current tenants for all of a property's objects, keyed by object code. */
export function usePropertyTenants(designation: string | undefined) {
  return useQuery({
    queryKey: ['audiencePropertyTenants', designation],
    queryFn: () => fetchPropertyTenants(designation as string),
    enabled: !!designation,
  })
}
