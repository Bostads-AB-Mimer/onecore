import { useQuery } from '@tanstack/react-query'
import {
  propertyService,
  buildingService,
  residenceService,
} from '@/services/api'
import { NavigationItem } from '@/services/types'

export function useSearch(query: string) {
  // Pre-fetch and cache all searchable items
  const prefetchQuery = useQuery({
    queryKey: ['searchItems'],
    queryFn: async () => {
      const [/*properties, */ buildings, residences] = await Promise.all([
        //propertyService.getAll(),
        Promise.resolve([]),
        buildingService.getAll(),
        residenceService.getAll(),
      ])

      return {
        properties,
        buildings,
        residences,
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Local search function
  const searchQuery = useQuery({
    queryKey: ['search', query],
    queryFn: () => {
      if (!query.trim() || !prefetchQuery.data) return []

      const searchTerm = query.toLowerCase()
      const results: NavigationItem[] = []

      // Search properties
      prefetchQuery.data.properties.forEach((property) => {
        if (
          property.designation.toLowerCase().includes(searchTerm) ||
          property.code.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            id: property.id,
            name: property.designation,
            type: 'property',
            metadata: { propertyId: property.id },
          })
        }
      })

      // Search buildings
      prefetchQuery.data.buildings.forEach((building) => {
        if (
          building.name.toLowerCase().includes(searchTerm) ||
          building.code.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            id: building.id,
            name: building.name,
            type: 'building',
            metadata: { buildingId: building.id },
          })
        }
      })

      // Search residences
      prefetchQuery.data.residences.forEach((residence) => {
        if (
          residence.name.toLowerCase().includes(searchTerm) ||
          residence.code.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            id: residence.id,
            name: `${residence.name} (${residence.code})`,
            type: 'residence',
            metadata: { residenceId: residence.id },
          })
        }
      })

      return results
    },
    enabled: prefetchQuery.data !== undefined,
  })

  return {
    results: searchQuery.data || [],
    isLoading: prefetchQuery.isLoading || searchQuery.isLoading,
    error: prefetchQuery.error || searchQuery.error,
  }
}
