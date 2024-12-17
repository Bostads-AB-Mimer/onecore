import React from 'react'
import { BuildingWithLinks, PropertyWithLinks } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './BuildingNavigation'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@/services/api'

interface PropertyNavigationProps {
  property: PropertyWithLinks
  selected: string | null
  onSelect: (property: PropertyWithLinks) => void
}

export function PropertyNavigation({
  property,
  selected,
  onSelect,
}: PropertyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const { data: buildings, isLoading, error } = useQuery({
    queryKey: ['buildings', property.id],
    queryFn: () => propertyService.getPropertyBuildings(property),
    enabled: isExpanded,
    select: (response) => response.content,
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
          onSelect(property)
        }}
        isActive={selected === property.id}
      >
        <Building />
        <span>{property.name}</span>
      </SidebarMenuButton>
      {isExpanded && buildings && buildings.length > 0 && (
        <SidebarMenu>
          {buildings.map((building) => (
            <BuildingNavigation
              key={building.id}
              building={building}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
