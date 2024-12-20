import React from 'react'
import { Property } from '@/services/types'
import { SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './Building'
import { useQuery } from '@tanstack/react-query'
import { buildingService } from '@/services/api'

interface BuildingListProps {
  property: Property
  onBuildingSelect?: (buildingId: string) => void
}

export function BuildingList({ property, onBuildingSelect }: BuildingListProps) {
  const {
    data: buildings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['buildings', property.id],
    queryFn: () => buildingService.getByPropertyCode(property.code),
  })

  if (isLoading) {
    return (
      <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
    )
  }

  if (error) {
    console.error(`Failed to load buildings for property ${property.id}:`, error)
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load buildings
      </div>
    )
  }

  return (
    <SidebarMenu>
      {buildings?.map((building) => (
        <BuildingNavigation
          key={building.code}
          building={building}
          onSelect={() => onBuildingSelect?.(building.id)}
        />
      ))}
    </SidebarMenu>
  )
}
