import React from 'react'
import { NavigationItem } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { StaircaseNavigation } from './StaircaseNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface BuildingNavigationProps {
  building: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function BuildingNavigation({ building, expanded, selected, onExpand, onSelect }: BuildingNavigationProps) {
  // Använd useAsync för att hantera laddning av staircases
  const { data: staircases, loading, error } = useAsync(async () => {
    if (expanded.has(building.id)) {
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
  }, [building.id, expanded])

  // Visa laddningsindikator
  if (loading && expanded.has(building.id)) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  // Visa felmeddelande om något gick fel
  if (error) {
    console.error(`Failed to load staircases for building ${building.id}:`, error)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(building)
          onSelect(building)
        }}
        isActive={selected === building.id}
        tooltip={building.name}
      >
        <Warehouse />
        <span>{building.name}</span>
      </SidebarMenuButton>
      {expanded.has(building.id) && staircases && staircases.length > 0 && (
        <SidebarMenu>
          {staircases.map(staircase => (
            <StaircaseNavigation
              key={staircase.id}
              staircase={staircase}
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
