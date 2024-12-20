import React from 'react'
import { Property } from '@/services/types'
import { Skeleton } from '../ui/skeleton'
import { SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './Building'
import { useQuery } from '@tanstack/react-query'
import { buildingService } from '@/services/api'

interface BuildingListProps {
  property: Property
}

export function BuildingList({ property }: BuildingListProps) {
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
      <>
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2" />
      </>
    )
  }

  if (error) {
    console.error(
      `Failed to load buildings for property ${property.id}:`,
      error
    )
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load buildings
      </div>
    )
  }

  return (
    <SidebarMenu>
      {buildings?.map((building) => (
        <BuildingNavigation key={building.code} building={building} />
      ))}
    </SidebarMenu>
  )
}
