import React from 'react'
import { Building, Staircase } from '@/services/types'
import { GitGraph } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface StaircaseNavigationProps {
  staircase: Staircase
  building: Building
  onSelect?: () => void
}

export function StaircaseNavigation({
  staircase,
  onSelect,
}: StaircaseNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onSelect}
        tooltip={staircase.name || staircase.code}
      >
        <GitGraph />
        <span>{staircase.code}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
