import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

import { maintenanceUnitService } from '@/services/api/core'
import { MaintenanceUnitBasicInfo } from '../maintenance-unit/MaintenanceUnitBasicInfo'
import { MaintenanceUnitComponents } from '../maintenance-unit/MaintenanceUnitComponents'
import { ObjectPageLayout } from '../layout/ObjectPageLayout'
import { ObjectPageTabs } from '../layout/ObjectPageTabs'
import { WorkOrdersManagement } from '../work-orders/WorkOrdersManagement'
import { ContextType } from '@/types/ui'

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

      <ObjectPageTabs
        defaultTab="workorders"
        tabs={[
          {
            value: 'components',
            label: 'Komponenter',
            icon: Wrench,
            content: (
              <MaintenanceUnitComponents
                propertyObjectId={maintenanceUnit.propertyObjectId}
                maintenanceUnitName={
                  maintenanceUnit.caption || maintenanceUnit.code
                }
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
                contextType={ContextType.MaintenanceUnit}
                id={maintenanceUnit.code}
              />
            ),
          },
        ]}
      />
    </ObjectPageLayout>
  )
}
