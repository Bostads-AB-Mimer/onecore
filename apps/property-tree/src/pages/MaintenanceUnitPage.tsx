import { useParams } from 'react-router-dom'

import { MaintenanceUnitTabs } from '@/widgets/maintenance-unit-tabs'

import {
  MaintenanceUnitBasicInfo,
  useMaintenanceUnit,
} from '@/features/maintenance-units'

import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

export function MaintenanceUnitPage() {
  const { code } = useParams()
  const { data, isLoading, error } = useMaintenanceUnit(code)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={data}
        notFoundMessage="Serviceenhet hittades inte"
        searchedFor={code}
      >
        {(maintenanceUnit) => (
          <>
            <MaintenanceUnitBasicInfo maintenanceUnit={maintenanceUnit} />

            <MaintenanceUnitTabs maintenanceUnit={maintenanceUnit} />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
