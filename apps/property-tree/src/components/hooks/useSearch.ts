import { useQuery } from '@tanstack/react-query'
import { searchService } from '@/services/api/core'
import { tenantService } from '@/services/api/core/tenantService'

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
