import { PropertyBuildingsList } from '@/components/properties/PropertyBuildingsList'
import { TabLayout } from '@/components/ui/TabLayout'
import type { Building } from '@/types/api'

interface PropertyBuildingsTabProps {
  buildings: Building[]
  propertyId: string
}

export const PropertyBuildingsTab = ({
  buildings,
  propertyId,
}: PropertyBuildingsTabProps) => {
  return (
    <TabLayout title="Byggnader" count={buildings?.length || 0} showCard={true}>
      <PropertyBuildingsList buildings={buildings} propertyId={propertyId} />
    </TabLayout>
  )
}
