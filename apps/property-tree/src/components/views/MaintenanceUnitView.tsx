import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Users, MessageSquare } from 'lucide-react'

import { maintenanceUnitService } from '@/services/api/core'
import { MaintenanceUnitBasicInfo } from '../maintenance-unit/MaintenanceUnitBasicInfo'
import { TenantInformation } from '../residence/TenantInformation'
import { WorkOrdersManagement } from '../work-orders/WorkOrdersManagement'
import { ObjectPageLayout } from '../layout/ObjectPageLayout'
import { ObjectPageTabs } from '../layout/ObjectPageTabs'

export function MaintenanceUnitView() {
  const { rentalId } = useParams()

  const maintenanceUnitQuery = useQuery({
    queryKey: ['maintenanceUnit', rentalId],
    queryFn: () => maintenanceUnitService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const maintenanceUnit = maintenanceUnitQuery.data

  if (!maintenanceUnit) {
    return (
      <ObjectPageLayout
        isLoading={maintenanceUnitQuery.isLoading}
        error={maintenanceUnitQuery.error}
        data={maintenanceUnit}
        notFoundMessage="Serviceenhet hittades inte"
        searchedFor={rentalId}
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
      searchedFor={rentalId}
    >
      <div className="lg:col-span-3 space-y-6">
        <MaintenanceUnitBasicInfo maintenanceUnit={maintenanceUnit} />
      </div>

      <ObjectPageTabs
        defaultTab="tenant"
        tabs={[
          {
            value: 'tenant',
            label: 'Hyresgäst',
            icon: Users,
            content: (
              <TenantInformation
                rentalPropertyId={maintenanceUnit.rentalPropertyId!}
              />
            ),
          },
          {
            value: 'inspections',
            label: 'Besiktningar',
            icon: ClipboardList,
            disabled: true,
          },
          {
            value: 'workorders',
            label: 'Ärenden',
            icon: MessageSquare,
            content: (
              <WorkOrdersManagement
                contextType="residence"
                id={maintenanceUnit.rentalPropertyId!}
              />
            ),
          },
        ]}
      />
    </ObjectPageLayout>
  )
}
