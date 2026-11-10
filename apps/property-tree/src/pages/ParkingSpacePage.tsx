import { useParams } from 'react-router-dom'

import { ParkingSpaceTabs } from '@/widgets/parking-space-tabs'

import {
  ParkingSpaceBasicInfo,
  useParkingSpace,
} from '@/features/parking-spaces'

import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

export function ParkingSpacePage() {
  const { rentalId } = useParams()
  const {
    data,
    isLoading,
    error,
    leases,
    leasesIsLoading,
    currentLease,
    objectRent,
    objectRentIsLoading,
  } = useParkingSpace(rentalId)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={data}
        notFoundMessage="Parkering hittades inte"
        searchedFor={rentalId}
      >
        {(parkingSpace) => (
          <>
            <ParkingSpaceBasicInfo
              parkingSpace={parkingSpace}
              rent={objectRent?.rent.amount}
              isRented={!!currentLease}
              isLoadingLease={leasesIsLoading}
              isLoadingRent={objectRentIsLoading}
            />

            <ParkingSpaceTabs
              parkingSpace={parkingSpace}
              leases={leases}
              leasesIsLoading={leasesIsLoading}
              currentLease={currentLease}
            />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
