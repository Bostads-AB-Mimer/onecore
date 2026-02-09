import { useParams } from 'react-router-dom'
import {
  useResidenceDetail,
  ResidenceBasicInfo,
  LoadingState,
  ErrorState,
} from '@/features/residences'
import { ResidenceTabs } from '@/widgets/residence-tabs'
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
  } = useResidenceDetail(residenceId!)

  const currentLease: Lease | undefined = leases?.[0] as Lease

  if (residenceIsLoading) {
    return (
      <div className="py-4">
        <LoadingState />
      </div>
    )
  }

  if (residenceError || !residence) {
    return (
      <div className="py-4">
        <ErrorState message={residenceError?.message} />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
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
    </div>
  )
}

export default ResidenceView
