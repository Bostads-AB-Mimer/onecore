import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { StaircaseList } from './StaircaseList'
import { ResidenceList } from './ResidenceList'

interface BuildingNavigationProps {
  building: Building
}

export function BuildingNavigation({ building }: BuildingNavigationProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/buildings/${building.id}`)
        }}
        tooltip={building.code}
      >
        <Warehouse />
        <span>{building.code}</span>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList building={building} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
