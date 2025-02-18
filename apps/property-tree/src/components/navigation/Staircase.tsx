import React from 'react'
import { useNavigate } from 'react-router-dom'
import { GitGraph } from 'lucide-react'

import { Building, Staircase } from '@/services/types'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { ResidenceList } from './ResidenceList'

interface StaircaseNavigationProps {
  staircase: Staircase
  building: Building
}

export function StaircaseNavigation({
  staircase,
  building,
}: StaircaseNavigationProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/staircases/${building.code}/${staircase.id}`)
        }}
        tooltip={staircase.name || staircase.code}
      >
        <GitGraph />
        <span>{staircase.code}</span>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList building={building} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
