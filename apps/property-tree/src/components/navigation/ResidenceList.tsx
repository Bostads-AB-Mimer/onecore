import React from 'react'
import { Building } from '@/services/types'
import { SidebarMenu } from '../ui/sidebar'
import { ResidenceNavigation } from './Residence'
import { useQuery } from '@tanstack/react-query'
import { residenceService } from '@/services/api'

interface ResidenceListProps {
  building: Building
  onResidenceSelect?: (residenceId: string) => void
}

export function ResidenceList({ building, onResidenceSelect }: ResidenceListProps) {
  const {
    data: residences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['residences', building.id],
    queryFn: () => residenceService.getByBuildingId(building.id),
  })

  if (isLoading) {
    return (
      <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
    )
  }

  if (error) {
    console.error(`Failed to load residences for building ${building.id}:`, error)
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load residences
      </div>
    )
  }

  return (
    <SidebarMenu>
      {residences?.map((residence) => (
        <ResidenceNavigation
          key={residence.id}
          residence={residence}
          onSelect={() => onResidenceSelect?.(residence.id)}
        />
      ))}
    </SidebarMenu>
  )
}
