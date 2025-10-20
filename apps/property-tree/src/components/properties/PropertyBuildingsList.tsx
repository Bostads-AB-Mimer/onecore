import type { Building } from '@/types/api'
import { PropertyBuildingCard } from './PropertyBuildingCard'

interface PropertyBuildingsListProps {
  buildings: Building[]
  propertyId: string
}

export const PropertyBuildingsList = ({
  buildings,
  propertyId,
}: PropertyBuildingsListProps) => {
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {buildings.map((building) => (
        <PropertyBuildingCard
          key={building.id}
          building={building}
          propertyId={propertyId}
        />
      ))}
    </div>
  )
}
