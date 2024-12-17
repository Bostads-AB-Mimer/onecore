import React from 'react'
import { BuildingWithLinks, PropertyWithLinks } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './BuildingNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface PropertyNavigationProps {
  property: PropertyWithLinks
  selected: string | null
  onSelect: (item: PropertyWithLinks) => void
}

export function PropertyNavigation({
  property,
  selected,
  onSelect,
}: PropertyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const {
    data: buildings,
    loading,
    error,
  } = useAsync(async () => {
    if (isExpanded) {
      if (!property._links?.buildings?.href) {
        throw new Error('Property is missing buildings link')
      }
      const response = await fetchApi<{ content: BuildingWithLinks[] }>(
        property._links.buildings.href
      )
      return response.content
    }
    return []
  }, [isExpanded])

  if (loading && isExpanded) {
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
