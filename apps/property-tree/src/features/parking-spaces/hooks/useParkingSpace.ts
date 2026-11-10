import { useQuery } from '@tanstack/react-query'

import {
  leaseService,
  parkingSpaceService,
  rentalObjectService,
} from '@/services/api/core'

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

  const currentLease =
    leasesQuery.data?.find((lease) => lease.status === 'Current') ??
    leasesQuery.data?.find((lease) => lease.status === 'AboutToEnd')

  // The rental object's configured rent from Tenfast — independent of leases,
  // so it is available for vacant objects too
  const objectRentQuery = useQuery({
    queryKey: ['rentalObjectRent', rentalId],
    queryFn: () => rentalObjectService.getRentByRentalObjectCode(rentalId!),
    enabled: !!rentalId,
  })

  return {
    data: parkingSpace,
    isLoading: parkingSpaceQuery.isLoading,
    error: parkingSpaceQuery.error,
    leases: leasesQuery.data,
    leasesIsLoading: leasesQuery.isLoading,
    currentLease,
    objectRent: objectRentQuery.data,
    objectRentIsLoading: objectRentQuery.isLoading,
  }
}
