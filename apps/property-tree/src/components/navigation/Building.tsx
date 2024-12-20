import React from 'react'
import { Building } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface BuildingNavigationProps {
  building: Building
  onSelect?: () => void
}

export function BuildingNavigation({
  building,
  onSelect,
}: BuildingNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onSelect}
        tooltip={building.code}
      >
        <Warehouse />
        <span>{building.code}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
