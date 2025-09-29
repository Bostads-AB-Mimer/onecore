import { PropertyBuildingsList } from '@/components/properties/PropertyBuildingsList'
import { TabLayout } from '@/components/ui/TabLayout'
import { Building2 } from 'lucide-react'
//import type { Building } from '@/types/api'

interface PropertyBuildingsTabProps {
  buildings: any[] //Building[]
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
