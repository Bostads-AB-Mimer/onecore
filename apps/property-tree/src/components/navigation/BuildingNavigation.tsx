import React from 'react'
import { BuildingWithLinks, StaircaseWithLinks } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { StaircaseNavigation } from './StaircaseNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface BuildingNavigationProps {
  building: BuildingWithLinks
  selected: string | null
  onSelect: (building: BuildingWithLinks) => void
}

export function BuildingNavigation({ building, selected, onSelect }: BuildingNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const { data: staircases, loading, error } = useAsync(async () => {
    if (isExpanded) {
      if (!building._links?.staircases?.href) {
        throw new Error('Building is missing staircases link')
      }
      const response = await fetchApi<{ content: NavigationItem[] }>(building._links.staircases.href)
      return response.content.map(staircase => ({
        id: staircase.id,
        name: staircase.name || staircase.code,
        type: 'staircase' as const,
        _links: staircase._links,
        children: []
      }))
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
    console.error(`Failed to load staircases for building ${building.id}:`, error)
    return (
      <SidebarMenuItem>
        <div className="text-sm text-destructive px-2">Failed to load staircases</div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSelect(building)
        }}
        isActive={selected === building.id}
        tooltip={building.name}
      >
        <Warehouse />
        <span>{building.name}</span>
      </SidebarMenuButton>
      {isExpanded && staircases && staircases.length > 0 && (
        <SidebarMenu>
          {staircases.map(staircase => (
            <StaircaseNavigation
              key={staircase.id}
              staircase={staircase}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
