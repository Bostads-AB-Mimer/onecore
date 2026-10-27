import { useQuery } from '@tanstack/react-query'

import {
  facilityService,
  leaseService,
  rentalObjectService,
} from '@/services/api/core'

export function useFacilityDetails(rentalId: string | undefined) {
  const facilityQuery = useQuery({
    queryKey: ['facility', rentalId],
    queryFn: () => facilityService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const facility = facilityQuery.data

  const leasesQuery = useQuery({
    queryKey: ['leases', facility?.rentalInformation?.rentalId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(
        facility!.rentalInformation!.rentalId!,
        { includeContacts: true }
      ),
    enabled: !!facility?.rentalInformation?.rentalId,
  })

  const currentLease = leasesQuery.data?.find(
    (lease) => lease.status === 'Current'
  )

  // The rental object's configured rent from Tenfast — independent of leases,
  // so it is available for vacant objects too
  const objectRentQuery = useQuery({
    queryKey: ['rentalObjectRent', rentalId],
    queryFn: () => rentalObjectService.getRentByRentalObjectCode(rentalId!),
    enabled: !!rentalId,
  })

  return {
    facility,
    leases: leasesQuery.data,
    currentLease,
    objectRent: objectRentQuery.data,
    objectRentIsLoading: objectRentQuery.isLoading,
    isLoading: facilityQuery.isLoading,
    leasesIsLoading: leasesQuery.isLoading,
    error: facilityQuery.error,
  }
}
