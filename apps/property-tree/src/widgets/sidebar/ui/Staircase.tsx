import React from 'react'
import { Link } from 'react-router-dom'
import { Building, Staircase } from '@/services/types'
import { GitGraph } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/shared/ui/Sidebar'
import { ResidenceList } from './ResidenceList'

interface StaircaseNavigationProps {
  staircase: Staircase
  building: Building
}

export function StaircaseNavigation({
  staircase,
  building,
}: StaircaseNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={staircase.name || staircase.code}>
        <Link
          to={`/staircases/${building.code}/${staircase.id}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <GitGraph />
          <span>{staircase.code}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList building={building} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
