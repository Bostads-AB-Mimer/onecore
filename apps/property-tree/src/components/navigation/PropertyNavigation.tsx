import React from 'react'
import { NavigationItem } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './BuildingNavigation'
import { fetchApi } from '@/services/api/baseApi'

interface PropertyNavigationProps {
  property: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function PropertyNavigation({ property, expanded, selected, onExpand, onSelect }: PropertyNavigationProps) {
  const [buildings, setBuildings] = React.useState<NavigationItem[]>([])

  React.useEffect(() => {
    if (expanded.has(property.id) && buildings.length === 0) {
      const loadBuildings = async () => {
        try {
          const response = await fetchApi<{ content: NavigationItem[] }>(property._links.buildings.href)
          setBuildings(response.content.map(building => ({
            id: building.id,
            name: building.name || building.code,
            type: 'building' as const,
            _links: building._links,
            children: []
          })))
        } catch (err) {
          console.error(`Failed to load buildings for property ${property.id}:`, err)
        }
      }
      loadBuildings()
    }
  }, [property, expanded, buildings.length])

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
