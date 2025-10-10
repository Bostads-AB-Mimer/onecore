import { WorkOrdersManagement } from '@/components/work-orders/WorkOrdersManagement'
import { TabLayout } from '@/components/ui/TabLayout'

interface PropertyOrdersTabProps {
  propertyDetail: any
}

export const PropertyOrdersTab = ({
  propertyDetail,
}: PropertyOrdersTabProps) => {
  // Use property directly as the property ID
  const propertyId = propertyDetail.code || 'property-default'

  return (
    <TabLayout title="Ärenden för fastighet" showCard={true}>
      <WorkOrdersManagement contextType="property" id={propertyId} />
    </TabLayout>
  )
}
