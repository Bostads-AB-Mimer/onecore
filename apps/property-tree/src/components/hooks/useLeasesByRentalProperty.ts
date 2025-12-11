import { useQuery } from '@tanstack/react-query'
import { leaseService } from '@/services/api/core'

export function useLeasesByRentalProperty(
  rentalPropertyId: string | undefined
) {
  const leasesQuery = useQuery({
    queryKey: ['leases', 'rental-property', rentalPropertyId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(rentalPropertyId!, {
        includeContacts: true,
        includeUpcomingLeases: true,
        includeTerminatedLeases: true,
      }),
    enabled: !!rentalPropertyId,
  })

  const isLoading = leasesQuery.isLoading
  const error = leasesQuery.error

  return {
    data: leasesQuery.data,
    isLoading,
    error,
  }
}
