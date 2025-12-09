import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GET } from '@/services/api/baseApi'
import type { Property, ResidenceSearchResult } from '@/services/types'
import type { SearchResult } from '@/components/properties/v2/SearchResultsTable'

type SearchTypeFilter = 'property' | 'residence'

export const usePropertyFilters = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTypeFilter, setSearchTypeFilter] =
    useState<SearchTypeFilter>('property')

  // Fetch properties search results
  const propertiesSearchQuery = useQuery({
    queryKey: ['properties-search', searchQuery],
    queryFn: async () => {
      const { data, error } = await GET('/properties/search', {
        params: { query: { q: searchQuery } },
      })
      if (error) throw error
      return data?.content || []
    },
    enabled: searchTypeFilter === 'property' && searchQuery.trim().length >= 3,
  })

  // Fetch residences search results
  const residencesSearchQuery = useQuery({
    queryKey: ['residences-search', searchQuery],
    queryFn: async () => {
      const { data, error } = await GET('/residences/search', {
        params: { query: { q: searchQuery } },
      })
      if (error) throw error
      return data?.content || []
    },
    enabled: searchTypeFilter === 'residence' && searchQuery.trim().length >= 3,
  })

  // Convert API results to SearchResult format
  const filteredSearchResults = useMemo((): SearchResult[] => {
    if (searchTypeFilter === 'property' && propertiesSearchQuery.data) {
      return propertiesSearchQuery.data.map((property: Property) => ({
        type: 'property' as const,
        id: property.id,
        code: property.code,
        designation: property.designation,
        municipality: property.municipality,
      }))
    }

    if (searchTypeFilter === 'residence' && residencesSearchQuery.data) {
      return residencesSearchQuery.data.map(
        (residence: ResidenceSearchResult) => ({
          type: 'residence' as const,
          id: residence.id,
          code: residence.code,
          name: residence.name,
          deleted: residence.deleted,
          rentalId: residence.rentalId,
        })
      )
    }

    return []
  }, [searchTypeFilter, propertiesSearchQuery.data, residencesSearchQuery.data])

  const showSearchResults = searchQuery.trim().length >= 3

  const isFiltering =
    (searchTypeFilter === 'property' && propertiesSearchQuery.isLoading) ||
    (searchTypeFilter === 'residence' && residencesSearchQuery.isLoading)

  return {
    searchQuery,
    setSearchQuery,
    searchTypeFilter,
    setSearchTypeFilter,
    filteredProperties: (propertiesSearchQuery.data as Property[]) || [],
    filteredSearchResults,
    showSearchResults,
    isFiltering,
  }
}
