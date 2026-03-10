import { useBuildings } from '@/features/buildings'

import { Property } from '@/services/types'

import { NavigationError, NavigationSkeleton } from '@/shared/ui/layout'
import { SidebarMenu } from '@/shared/ui/Sidebar'

import { BuildingNavigation } from './Building'

interface BuildingListProps {
  property: Property
  organizationNumber?: string
}

export function BuildingList({
  property,
  organizationNumber,
}: BuildingListProps) {
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
          organizationNumber={organizationNumber}
        />
      ))}
    </SidebarMenu>
  )
}
