import { TabLayout } from '@/components/ui/TabLayout'
import type { Building } from '@/services/types'
import { WorkOrdersManagement } from '@/components/work-orders/WorkOrdersManagement'

interface BuildingOrdersTabProps {
  building: Building
}

export const BuildingOrdersTab = ({ building }: BuildingOrdersTabProps) => {
  return (
    <TabLayout title="Ärenden för byggnad" showCard={false}>
      <WorkOrdersManagement contextType="building" id={building.code} />
    </TabLayout>
  )
}
