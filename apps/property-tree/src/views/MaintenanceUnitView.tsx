import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { maintenanceUnitService } from '@/services/api/core'
import { MaintenanceUnitBasicInfo } from '@/features/maintenance-units'
import { ObjectPageLayout } from '../layouts/ObjectPageLayout'
import { MaintenanceUnitTabs } from '@/widgets/maintenance-unit-tabs'

export function MaintenanceUnitView() {
  const { code } = useParams()

  const maintenanceUnitQuery = useQuery({
    queryKey: ['maintenanceUnit', code],
    queryFn: () => maintenanceUnitService.getByCode(code!),
    enabled: !!code,
  })

  const maintenanceUnit = maintenanceUnitQuery.data

  if (!maintenanceUnit) {
    return (
      <ObjectPageLayout
        isLoading={maintenanceUnitQuery.isLoading}
        error={maintenanceUnitQuery.error}
        data={maintenanceUnit}
        notFoundMessage="Serviceenhet hittades inte"
        searchedFor={code}
      >
        <></>
      </ObjectPageLayout>
    )
  }

  return (
    <ObjectPageLayout
      isLoading={maintenanceUnitQuery.isLoading}
      error={maintenanceUnitQuery.error}
      data={maintenanceUnit}
      notFoundMessage="Serviceenhet hittades inte"
      searchedFor={code}
    >
      <div className="lg:col-span-3 space-y-6">
        <MaintenanceUnitBasicInfo maintenanceUnit={maintenanceUnit} />
      </div>

      <div className="lg:col-span-3">
        <MaintenanceUnitTabs maintenanceUnit={maintenanceUnit} />
      </div>
    </ObjectPageLayout>
  )
}
