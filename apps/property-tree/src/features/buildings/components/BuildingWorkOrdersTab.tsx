import { TabLayout } from '@/components/ui/TabLayout'
import type { Building } from '@/services/types'
import { WorkOrdersManagement } from '@/features/work-orders/components/WorkOrdersManagement'

import { ContextType } from '@/types/ui'

interface BuildingWorkOrdersTabProps {
  building: Building
}

export const BuildingWorkOrdersTab = ({
  building,
}: BuildingWorkOrdersTabProps) => {
  return (
    <TabLayout title="Ärenden för byggnad" showCard={false}>
      <WorkOrdersManagement
        contextType={ContextType.Building}
        id={building.code}
      />
    </TabLayout>
  )
}
