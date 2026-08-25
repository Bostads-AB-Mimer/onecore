import { useQuery } from '@tanstack/react-query'

import type {
  ContactInfo,
  LeaseSearchResult,
} from '@/services/api/core/leaseSearchService'
import { leaseSearchService } from '@/services/api/core/leaseSearchService'

/**
 * Fetches contact details (email, phone) for all contacts on the current page
 * and returns enriched leases with merged contact data.
 */
export function useContactEnrichment(leases: LeaseSearchResult[] | undefined) {
  const contactCodes = [
    ...new Set(
      (leases ?? []).flatMap((l) => l.contacts?.map((c) => c.contactCode) ?? [])
    ),
  ]

  const contactsQuery = useQuery({
    queryKey: ['contacts-by-codes', contactCodes.sort().join(',')],
    queryFn: () => leaseSearchService.getContactsByCodes(contactCodes),
    enabled: contactCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const contactMap = new Map<string, ContactInfo>()
  for (const c of contactsQuery.data ?? []) {
    contactMap.set(c.contactCode, c)
  }

  const enrichedLeases: LeaseSearchResult[] | undefined = leases?.map((l) => ({
    ...l,
    contacts: l.contacts?.map((c) => {
      const enriched = contactMap.get(c.contactCode)
      return enriched
        ? {
            ...c,
            email: enriched.email,
            phone: enriched.phone,
            name: enriched.name || c.name,
          }
        : c
    }),
  }))

  return {
    leases: enrichedLeases,
    isLoadingContacts: contactsQuery.isLoading && contactCodes.length > 0,
  }
}
