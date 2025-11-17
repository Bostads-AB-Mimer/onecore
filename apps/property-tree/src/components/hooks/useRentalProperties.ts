import { useQueries } from '@tanstack/react-query'
import { rentalPropertyService } from '@/services/api/core'
import type { RentalPropertyInfo } from '@onecore/types'

export function useRentalProperties(rentalPropertyIds: string[]) {
  // Get unique IDs to avoid duplicate requests
  const uniqueIds = Array.from(new Set(rentalPropertyIds))

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: ['rentalProperty', id],
      queryFn: () => rentalPropertyService.getByRentalObjectCode(id),
      enabled: !!id,
    })),
  })

  // Aggregate loading and error states
  const isLoading = queries.some((q) => q.isLoading)
  const error = queries.find((q) => q.error)?.error

  // Create a map of rental property ID to rental property data
  const rentalPropertiesMap: Record<string, RentalPropertyInfo> = {}
  queries.forEach((query, index) => {
    if (query.data) {
      rentalPropertiesMap[uniqueIds[index]] = query.data
    }
  })

  return {
    data: rentalPropertiesMap,
    isLoading,
    error,
  }
}
