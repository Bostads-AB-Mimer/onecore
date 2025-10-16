import { WorkOrdersManagement } from '@/components/work-orders/WorkOrdersManagement'
import { TabLayout } from '@/components/ui/TabLayout'
import type { PropertyDetail } from '@/types/api'

interface PropertyOrdersTabProps {
  propertyDetail: PropertyDetail
}

export const PropertyOrdersTab = ({
  propertyDetail,
}: PropertyOrdersTabProps) => {
  // Validate that property code exists
  if (!propertyDetail.code) {
    return (
      <TabLayout title="Ärenden för fastighet" showCard={false}>
        <div className="text-red-500 p-4 border border-red-200 rounded-md bg-red-50">
          Fastighetskod saknas. Kunde inte hämta ärenden.
        </div>
      </TabLayout>
    )
  }

  return (
    <TabLayout title="Ärenden för fastighet" showCard={false}>
      <WorkOrdersManagement contextType="property" id={propertyDetail.code} />
    </TabLayout>
  )
}
