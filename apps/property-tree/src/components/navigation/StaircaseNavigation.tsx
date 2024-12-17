import React from 'react'
import { StaircaseWithLinks, ResidenceWithLinks } from '@/services/types'
import { Home } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { ResidenceNavigation } from './ResidenceNavigation'
import { useQuery } from '@tanstack/react-query'

interface StaircaseNavigationProps {
  staircase: StaircaseWithLinks
}

export function StaircaseNavigation({ staircase }: StaircaseNavigationProps) {
  const { selectedId, selectItem } = useNavigation()
  const [isExpanded, setIsExpanded] = React.useState(false)

  const { data: residences, isLoading, error } = useQuery({
    queryKey: ['residences', staircase.id],
    queryFn: () => fetchApi<{ content: NavigationItem[] }>(staircase._links.residences.href),
    enabled: isExpanded && !!staircase._links?.residences?.href,
    select: (response) => response.content.map(residence => ({
      id: residence.id,
      name: residence.name || residence.code,
      type: 'residence' as const,
      _links: residence._links,
      children: []
    }))
  })

  if (isLoading && isExpanded) {
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
