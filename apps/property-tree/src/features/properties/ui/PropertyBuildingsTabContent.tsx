import type { Building } from '@/shared/types/api'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { PropertyBuildingCard } from './PropertyBuildingCard'

interface PropertyBuildingsTabContentProps {
  buildings: Building[]
}

export const PropertyBuildingsTabContent = ({
  buildings,
}: PropertyBuildingsTabContentProps) => {
  return (
    <TabLayout title="Byggnader" count={buildings?.length || 0} showCard={true}>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {buildings.map((building) => (
          <PropertyBuildingCard key={building.id} building={building} />
        ))}
      </div>
    </TabLayout>
  )
}
