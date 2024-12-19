import React from 'react'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './BuildingNavigation'
import { useQuery } from '@tanstack/react-query'
import { GET } from '@/services/api/baseApi'
import { buildingService } from '@/services/api'
interface PropertyNavigationProps {
  property: Property
}

export function PropertyNavigation({ property }: PropertyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const {
    data: buildings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['buildings', property.id],
    queryFn: () => buildingService.getByPropertyCode(property.code),
    enabled: isExpanded,
    select: (response) => response,
  })

  if (isLoading && isExpanded) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  if (error) {
    console.error(
      `Failed to load buildings for property ${property.id}:`,
      error
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
        }}
      >
        <Building />
        <span>{property.designation}</span>
      </SidebarMenuButton>
      {isExpanded && buildings && buildings.length > 0 && (
        <SidebarMenu>
          {buildings.map((building) => (
            <BuildingNavigation key={building.id} building={building} />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
