import { useQueries } from '@tanstack/react-query'
import { rentalPropertyService } from '@/services/api/core'
import type { RentalPropertyInfo } from '@onecore/types'

export function useRentalProperties(rentalPropertyIds: string[]): {
  data: Record<string, RentalPropertyInfo | null>
  isLoading: boolean
  error: Error | undefined
} {
  // Get unique IDs to avoid duplicate requests
  const uniqueIds = Array.from(new Set(rentalPropertyIds))

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: ['rentalProperty', id],
      queryFn: async () => {
        try {
          return await rentalPropertyService.getByRentalObjectCode(id)
        } catch (error: any) {
          // openapi-fetch v0.13.5 returns errors with status property
          if (error?.status === 404) {
            return null // Expected for sold properties
          }
          throw error // Re-throw other errors (500, network)
        }
      },
      enabled: !!id,
      retry: (failureCount: number, error: any) => {
        if (error?.status === 404) return false // Don't retry missing objects
        return failureCount < 3 // Retry other errors up to 3 times
      },
    })),
  })

  // Aggregate loading and error states
  const isLoading = queries.some((q) => q.isLoading)
  const error =
    queries.find((q) => {
      if (!q.error) return false
      return (q.error as any)?.status !== 404 // Only treat non-404 as errors
    })?.error ?? undefined

  // Create a map of rental property ID to rental property data
  const rentalPropertiesMap: Record<string, RentalPropertyInfo | null> = {}
  queries.forEach((query, index) => {
    // Include null for 404s (queryFn returns null)
    rentalPropertiesMap[uniqueIds[index]] = query.data ?? null
  })

  return {
    data: rentalPropertiesMap,
    isLoading,
    error,
  }
}
