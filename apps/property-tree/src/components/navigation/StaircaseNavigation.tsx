import React from 'react'
import { StaircaseWithLinks, ResidenceWithLinks } from '@/services/types'
import { Home } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { ResidenceNavigation } from './ResidenceNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface StaircaseNavigationProps {
  staircase: StaircaseWithLinks
  selected: string | null
  onSelect: (staircase: StaircaseWithLinks) => void
}

export function StaircaseNavigation({ staircase, selected, onSelect }: StaircaseNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const { data: residences, loading, error } = useAsync(async () => {
    if (isExpanded) {
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
  }, [isExpanded])

  if (loading && isExpanded) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  if (error) {
    console.error(`Failed to load residences for staircase ${staircase.id}:`, error)
    return (
      <SidebarMenuItem>
        <div className="text-sm text-destructive px-2">Failed to load residences</div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSelect(staircase)
        }}
        isActive={selected === staircase.id}
        tooltip={staircase.name}
      >
        <Home />
        <span>{staircase.name}</span>
      </SidebarMenuButton>
      {isExpanded && residences && residences.length > 0 && (
        <SidebarMenu>
          {residences.map(residence => (
            <ResidenceNavigation
              key={residence.id}
              residence={residence}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
