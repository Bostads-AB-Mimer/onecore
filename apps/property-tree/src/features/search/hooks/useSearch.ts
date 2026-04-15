import { useQuery } from '@tanstack/react-query'

import { searchService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import {
  type ContactSearchResult,
  tenantService,
} from '@/services/api/core/tenantService'

type SearchResult = components['schemas']['SearchResult']
type ContactResult = ContactSearchResult & { type: 'contact'; id: string }
export type CombinedSearchResult = SearchResult | ContactResult

export function useSearch(query: string) {
  const trimmedQuery = query.trim()
  return useQuery({
    queryKey: ['search', trimmedQuery],
    enabled: Boolean(trimmedQuery) && trimmedQuery.length > 2,
    queryFn: async () => {
      const [propertyResults, contactResults] = await Promise.all([
        searchService.search(trimmedQuery),
        tenantService.searchContacts(trimmedQuery),
      ])

      return [
        ...propertyResults,
        ...contactResults.map((contact) => ({
          ...contact,
          type: 'contact' as const,
          id: contact.contactCode,
        })),
      ]
    },
  })
}
