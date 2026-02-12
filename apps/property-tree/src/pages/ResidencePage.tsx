import { useParams } from 'react-router-dom'

import { ResidenceTabs } from '@/widgets/residence-tabs'

import { ResidenceBasicInfo, useResidenceDetails } from '@/features/residences'

import { Lease } from '@/services/api/core'

import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

export const ResidencePage = () => {
  const { residenceId } = useParams()

  const {
    residence,
    residenceIsLoading,
    residenceError,
    building,
    leases,
    leasesIsLoading,
    leasesError,
  } = useResidenceDetails(residenceId!)

  const currentLease: Lease | undefined = leases?.[0] as Lease

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={residenceIsLoading}
        error={residenceError}
        data={residence}
        notFoundMessage="Bostaden kunde inte hittas"
        searchedFor={residenceId}
      >
        {(residence) => (
          <>
            <ResidenceBasicInfo
              residence={residence}
              building={building}
              lease={currentLease}
            />

            <ResidenceTabs
              residence={residence}
              currentLease={currentLease}
              leasesIsLoading={leasesIsLoading}
              leasesError={leasesError}
            />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
