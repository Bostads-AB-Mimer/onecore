import { Property } from '@/services/types'
import { SidebarMenu } from '@/shared/ui/Sidebar'
import { BuildingNavigation } from './Building'
import { NavigationSkeleton, NavigationError } from '@/shared/ui/layout'
import { useBuildings } from '@/features/buildings'

interface BuildingListProps {
  property: Property
  companyId?: string
}

export function BuildingList({ property, companyId }: BuildingListProps) {
  const { data: buildings, isLoading, error } = useBuildings(property.code)

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="buildings" />

  return (
    <SidebarMenu>
      {buildings?.map((building) => (
        <BuildingNavigation
          key={building.code}
          property={property}
          building={building}
          companyId={companyId}
        />
      ))}
    </SidebarMenu>
  )
}
