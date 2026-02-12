import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { maintenanceUnitService } from '@/services/api/core'
import { MaintenanceUnitBasicInfo } from '@/features/maintenance-units'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { MaintenanceUnitTabs } from '@/widgets/maintenance-unit-tabs'

export function MaintenanceUnitView() {
  const { code } = useParams()

  const maintenanceUnitQuery = useQuery({
    queryKey: ['maintenanceUnit', code],
    queryFn: () => maintenanceUnitService.getByCode(code!),
    enabled: !!code,
  })

  const maintenanceUnit = maintenanceUnitQuery.data

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={maintenanceUnitQuery.isLoading}
        error={maintenanceUnitQuery.error}
        data={maintenanceUnit}
        notFoundMessage="Serviceenhet hittades inte"
        searchedFor={code}
      >
        {(maintenanceUnit) => (
          <>
            <div className="lg:col-span-3 space-y-6">
              <MaintenanceUnitBasicInfo maintenanceUnit={maintenanceUnit} />
            </div>

            <div className="lg:col-span-3">
              <MaintenanceUnitTabs maintenanceUnit={maintenanceUnit} />
            </div>
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
