import { PropertyBuildingsList } from '@/features/properties/components/PropertyBuildingsList'
import { TabLayout } from '@/components/ui/TabLayout'
import type { Building } from '@/types/api'

interface PropertyBuildingsTabProps {
  buildings: Building[]
}

export const PropertyBuildingsTab = ({
  buildings,
}: PropertyBuildingsTabProps) => {
  return (
    <TabLayout title="Byggnader" count={buildings?.length || 0} showCard={true}>
      <PropertyBuildingsList buildings={buildings} />
    </TabLayout>
  )
}
