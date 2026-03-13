import { useParams } from 'react-router-dom'

import { FacilityTabs } from '@/widgets/facility-tabs'

import { FacilityBasicInfo, useFacilityDetails } from '@/features/facilities'

import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

export function FacilityPage() {
  const { rentalId } = useParams()
  const {
    facility,
    leases,
    currentLease,
    currentRent,
    isLoading,
    leasesIsLoading,
    error,
  } = useFacilityDetails(rentalId)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={facility}
        notFoundMessage="Lokal hittades inte"
        searchedFor={rentalId}
      >
        {(facility) => (
          <>
            <h1 className="text-3xl font-bold">
              {facility.name || facility.code}
            </h1>

            <FacilityBasicInfo
              facility={facility}
              rent={currentRent}
              isRented={!!currentLease}
              isLoadingLease={leasesIsLoading}
            />

            <FacilityTabs
              facility={facility}
              leases={leases}
              leasesIsLoading={leasesIsLoading}
            />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
