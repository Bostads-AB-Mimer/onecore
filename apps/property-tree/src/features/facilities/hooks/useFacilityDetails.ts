import { useQuery } from '@tanstack/react-query'

import { facilityService, leaseService } from '@/services/api/core'

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

  return {
    facility,
    leases: leasesQuery.data,
    currentLease,
    currentRent: currentLease?.rentInfo?.currentRent?.currentRent,
    isLoading: facilityQuery.isLoading,
    leasesIsLoading: leasesQuery.isLoading,
    error: facilityQuery.error,
  }
}
