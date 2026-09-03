import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { GET } from '@/services/api/core/baseApi'
import type { Property } from '@/services/types'

import type { SearchResult } from '../types'

// 'rental-object' hands the page over to the hyresobjekt list, which scopes
// through the property-tree picker rather than this omni-search. Bostad,
// bilplats and lokal are no longer chips here because that list covers them —
// its picker searches objektnummer, adress and fastighet.
export type SearchTypeFilter = 'property' | 'maintenance-unit' | 'rental-object'

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

  // Fetch maintenance units search results
  const maintenanceUnitsSearchQuery = useQuery({
    queryKey: ['maintenance-units-search', searchQuery],
    queryFn: async () => {
      const { data, error } = await GET('/maintenance-units/search', {
        params: { query: { q: searchQuery } },
      })
      if (error) throw error
      return data?.content || []
    },
    enabled:
      searchTypeFilter === 'maintenance-unit' && searchQuery.trim().length >= 3,
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

    if (
      searchTypeFilter === 'maintenance-unit' &&
      maintenanceUnitsSearchQuery.data
    ) {
      return maintenanceUnitsSearchQuery.data.map((unit: any) => ({
        type: 'maintenance-unit' as const,
        id: unit.id,
        code: unit.code,
        caption: unit.caption,
        maintenanceType: unit.type,
        property: {
          code: unit.estateCode,
          name: unit.estate,
        },
      }))
    }

    return []
  }, [
    searchTypeFilter,
    propertiesSearchQuery.data,
    maintenanceUnitsSearchQuery.data,
  ])

  const showSearchResults = searchQuery.trim().length >= 3

  const isFiltering =
    (searchTypeFilter === 'property' && propertiesSearchQuery.isLoading) ||
    (searchTypeFilter === 'maintenance-unit' &&
      maintenanceUnitsSearchQuery.isLoading)

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
