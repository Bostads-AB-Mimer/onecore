import React from 'react'
import { NavigationItem } from '@/services/types'
import { Home } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { ResidenceNavigation } from './ResidenceNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface StaircaseNavigationProps {
  staircase: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function StaircaseNavigation({ staircase, expanded, selected, onExpand, onSelect }: StaircaseNavigationProps) {
  // Använd useAsync för att hantera laddning av residences
  const { data: residences, loading, error } = useAsync(async () => {
    if (expanded.has(staircase.id)) {
      if (!staircase._links?.residences?.href) {
        throw new Error('Staircase is missing residences link')
      }
      const response = await fetchApi<{ content: NavigationItem[] }>(staircase._links.residences.href)
      return response.content.map(residence => ({
        id: residence.id,
        name: residence.name || residence.code,
        type: 'residence' as const,
        _links: residence._links,
        children: []
      }))
    }
    return []
  }, [staircase.id, expanded])

  // Visa laddningsindikator
  if (loading && expanded.has(staircase.id)) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  // Visa felmeddelande om något gick fel
  if (error) {
    console.error(`Failed to load residences for staircase ${staircase.id}:`, error)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(staircase)
          onSelect(staircase)
        }}
        isActive={selected === staircase.id}
        tooltip={staircase.name}
      >
        <Home />
        <span>{staircase.name}</span>
      </SidebarMenuButton>
      {expanded.has(staircase.id) && residences && residences.length > 0 && (
        <SidebarMenu>
          {residences.map(residence => (
            <ResidenceNavigation
              key={residence.id}
              residence={residence}
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
