import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { StaircaseList } from './StaircaseList'

interface BuildingNavigationProps {
  building: Building
  onSelect: () => void
}

export function BuildingNavigation({
  building,
  onSelect,
}: BuildingNavigationProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSelect()
          navigate(`/buildings/${building.id}`)
        }}
        tooltip={building.code}
      >
        <Warehouse />
        <span>{building.code}</span>
      </SidebarMenuButton>
      {isExpanded && <StaircaseList building={building} />}
    </SidebarMenuItem>
  )
}
