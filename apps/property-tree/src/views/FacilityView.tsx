import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { facilityService, leaseService } from '@/services/api/core'
import { FacilityBasicInfo } from '../features/facilities'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { FacilityTabs } from '@/widgets/facility-tabs'

export function FacilityView() {
  const { rentalId } = useParams()

  const facilityQuery = useQuery({
    queryKey: ['facility', rentalId],
    queryFn: () => facilityService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const facility = facilityQuery.data

  // Fetch lease data for rent info and to pass to CurrentTenant
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
  const currentRent = currentLease?.rentInfo?.currentRent?.currentRent

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={facilityQuery.isLoading}
        error={facilityQuery.error}
        data={facility}
        notFoundMessage="Lokal hittades inte"
        searchedFor={rentalId}
      >
        {(facility) => (
          <>
            <div className="lg:col-span-3 space-y-6">
              <FacilityBasicInfo
                facility={facility}
                rent={currentRent}
                isRented={!!currentLease}
                isLoadingLease={leasesQuery.isLoading}
              />
            </div>

            <div className="lg:col-span-3">
              <FacilityTabs
                facility={facility}
                leases={leasesQuery.data}
                leasesIsLoading={leasesQuery.isLoading}
              />
            </div>
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
