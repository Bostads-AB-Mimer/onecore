import React from 'react'
import { Building, Company, Property, Staircase } from '@/services/types'
import { GitGraph, Home } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { ResidenceNavigation } from './Residence'
import { useQuery } from '@tanstack/react-query'
import { GET } from '@/services/api/baseApi'

interface StaircaseNavigationProps {
  staircase: Staircase
  company: Company
  building: Building
  property: Property
}

export function StaircaseNavigation({
  staircase,
  building,
}: StaircaseNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const {
    data: residences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['residences', staircase.id],
    queryFn: () =>
      GET('/residences', {
        params: { query: { buildingCode: building.code } },
      }),
    select: (response) => response.data?.content,
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
      `Failed to load residences for staircase ${staircase.id}:`,
      error
    )
    return (
      <SidebarMenuItem>
        <div className="text-sm text-destructive px-2">
          Failed to load residences
        </div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
        }}
      >
        <GitGraph />
        <span>{staircase.code}</span>
      </SidebarMenuButton>
      {isExpanded && residences && residences.length > 0 && (
        <SidebarMenu>
          {residences.map((residence) => (
            <ResidenceNavigation key={residence.id} residence={residence} />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
