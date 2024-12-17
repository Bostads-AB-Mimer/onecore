import React from 'react'
import { NavigationItem } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './BuildingNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface PropertyNavigationProps {
  property: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function PropertyNavigation({ property, expanded, selected, onExpand, onSelect }: PropertyNavigationProps) {
  const { data: buildings, loading, error } = useAsync(async () => {
    if (expanded.has(property.id)) {
      if (!property._links?.buildings?.href) {
        throw new Error('Property is missing buildings link')
      }
      const response = await fetchApi<{ content: NavigationItem[] }>(property._links.buildings.href)
      return response.content.map(building => ({
        id: building.id,
        name: building.name || building.code,
        type: 'building' as const,
        _links: building._links,
        children: []
      }))
    }
    return []
  }, [property.id, expanded])

  // Visa laddningsindikator
  if (loading && expanded.has(property.id)) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  // Visa felmeddelande om något gick fel
  if (error) {
    console.error(`Failed to load buildings for property ${property.id}:`, error)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(property)
          onSelect(property)
        }}
        isActive={selected === property.id}
      >
        <Building />
        <span>{property.name}</span>
      </SidebarMenuButton>
      {expanded.has(property.id) && buildings.length > 0 && (
        <SidebarMenu>
          {buildings.map(building => (
            <BuildingNavigation
              key={building.id}
              building={building}
              expanded={expanded}
              selected={selected}
              onExpand={onExpand}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
