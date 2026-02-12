import { useParams } from 'react-router-dom'
import { useResidenceDetails, ResidenceBasicInfo } from '@/features/residences'
import { ResidenceTabs } from '@/widgets/residence-tabs'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { Lease } from '@/services/api/core'

export const ResidenceView = () => {
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

            <div className="lg:col-span-3 space-y-6">
              <ResidenceTabs
                residence={residence}
                currentLease={currentLease}
                leasesIsLoading={leasesIsLoading}
                leasesError={leasesError}
              />
            </div>
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}

export default ResidenceView
