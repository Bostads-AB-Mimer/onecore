import React from 'react'
import { Building, Property } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { ResidenceList } from './ResidenceList'

interface BuildingNavigationProps {
  building: Building
  property: Property
}

export function BuildingNavigation({ building }: BuildingNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <div className="flex items-center justify-between pr-2">
        <SidebarMenuButton
          onClick={() => setIsExpanded(!isExpanded)}
          tooltip={building.code}
        >
          <Warehouse />
          <span>{building.code}</span>
        </SidebarMenuButton>
      </div>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList building={building} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
