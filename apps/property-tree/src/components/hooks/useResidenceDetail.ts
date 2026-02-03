import {
  buildingService,
  Lease,
  leaseService,
  residenceService,
} from '@/services/api/core'
import { Building } from '@/services/types'
import { useQuery } from '@tanstack/react-query'

export function useResidenceDetail(residenceId: string) {
  const residenceQuery = useQuery({
    queryKey: ['residence', residenceId],
    queryFn: () => residenceService.getById(residenceId!),
    enabled: !!residenceId,
  })

  const residence = residenceQuery.data

  // Fetching building to be able to show building details in residence view
  const buildingQuery = useQuery({
    queryKey: ['building', residence?.building.code],
    queryFn: () => buildingService.getByBuildingCode(residence?.building.code!),
    enabled: !!residence,
  })

  // Fetching leases to be able to show lease details in residence view such as rent information
  const leasesQuery = useQuery({
    queryKey: ['leases', residence?.propertyObject.rentalId],
    queryFn: () => {
      if (residence && residence.propertyObject.rentalId) {
        return leaseService.getByRentalPropertyId(
          residence?.propertyObject.rentalId,
          {
            includeContacts: true,
            includeRentInfo: true,
          }
        )
      }
    },
    enabled: !!residence,
  })

  return {
    residence,
    residenceIsLoading: residenceQuery.isLoading,
    residenceError: residenceQuery.error,
    building: buildingQuery.data as Building,
    buildingIsLoading: buildingQuery.isLoading,
    buildingError: buildingQuery.error,
    leases: leasesQuery.data as Lease[],
    leasesIsLoading: leasesQuery.isLoading,
    leasesError: leasesQuery.error,
  }
}
