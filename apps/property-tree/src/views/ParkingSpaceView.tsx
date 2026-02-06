import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { parkingSpaceService, leaseService } from '@/services/api/core'
import { ParkingSpaceBasicInfo } from '@/features/parking-spaces'
import { ObjectPageLayout } from '../layouts/ObjectPageLayout'
import { ParkingSpaceTabs } from '@/widgets/parking-space-tabs'

export function ParkingSpaceView() {
  const { rentalId } = useParams()

  const parkingSpaceQuery = useQuery({
    queryKey: ['parkingSpace', rentalId],
    queryFn: () => parkingSpaceService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const parkingSpace = parkingSpaceQuery.data

  // Fetch lease data for rent info and to pass to CurrentTenant
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

  if (!parkingSpace) {
    return (
      <ObjectPageLayout
        isLoading={parkingSpaceQuery.isLoading}
        error={parkingSpaceQuery.error}
        data={parkingSpace}
        notFoundMessage="Parkering hittades inte"
        searchedFor={rentalId}
      >
        <></>
      </ObjectPageLayout>
    )
  }

  return (
    <ObjectPageLayout
      isLoading={parkingSpaceQuery.isLoading}
      error={parkingSpaceQuery.error}
      data={parkingSpace}
      notFoundMessage="Parkering hittades inte"
      searchedFor={rentalId}
    >
      <div className="lg:col-span-3 space-y-6">
        <ParkingSpaceBasicInfo
          parkingSpace={parkingSpace}
          rent={currentRent}
          isLoadingRent={leasesQuery.isLoading}
        />
      </div>

      <div className="lg:col-span-3">
        <ParkingSpaceTabs
          parkingSpace={parkingSpace}
          leases={leasesQuery.data}
          leasesIsLoading={leasesQuery.isLoading}
        />
      </div>
    </ObjectPageLayout>
  )
}
