import { useQuery } from '@tanstack/react-query'
import { searchService } from '@/services/api/core'
import {
  tenantService,
  type ContactSearchResult,
} from '@/services/api/core/tenantService'
import type { components } from '@/services/api/core/generated/api-types'

type SearchResult = components['schemas']['SearchResult']
type ContactResult = ContactSearchResult & { type: 'contact'; id: string }
export type CombinedSearchResult = SearchResult | ContactResult

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: Boolean(query) && query.length > 2,
    queryFn: async () => {
      const [propertyResults, contactResults] = await Promise.all([
        searchService.search(query),
        tenantService.searchContacts(query),
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
