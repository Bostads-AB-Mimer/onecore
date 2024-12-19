import React from 'react'
import { Company, Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './Building'
import { useQuery } from '@tanstack/react-query'
import { buildingService } from '@/services/api'

interface PropertyNavigationProps {
  property: Property
  company: Company
}

export function PropertyNavigation({
  property,
  company,
}: PropertyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const {
    data: buildings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['buildings', property.id],
    queryFn: () => buildingService.getByPropertyCode(property.code),
    enabled: isExpanded,
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
            <BuildingNavigation
              key={building.code}
              building={building}
              company={company}
              property={property}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
