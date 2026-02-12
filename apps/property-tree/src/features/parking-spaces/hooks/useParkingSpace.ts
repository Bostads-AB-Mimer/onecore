import { useQuery } from '@tanstack/react-query'

import { leaseService, parkingSpaceService } from '@/services/api/core'

export function useParkingSpace(rentalId: string | undefined) {
  const parkingSpaceQuery = useQuery({
    queryKey: ['parkingSpace', rentalId],
    queryFn: () => parkingSpaceService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const parkingSpace = parkingSpaceQuery.data

  const leasesQuery = useQuery({
    queryKey: ['leases', parkingSpace?.rentalId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(parkingSpace!.rentalId!, {
        includeContacts: true,
      }),
    enabled: !!parkingSpace?.rentalId,
  })

  const currentLease = leasesQuery.data?.find(
    (lease) => lease.status === 'Current'
  )
  const currentRent = currentLease?.rentInfo?.currentRent?.currentRent

  return {
    data: parkingSpace,
    isLoading: parkingSpaceQuery.isLoading,
    error: parkingSpaceQuery.error,
    leases: leasesQuery.data,
    leasesIsLoading: leasesQuery.isLoading,
    currentRent,
  }
}
