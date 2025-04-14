import { useQuery } from '@tanstack/react-query'
import { searchService } from '@/services/api'

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: Boolean(query) && query.length > 2,
    queryFn: () => searchService.search(query),
  })
}
