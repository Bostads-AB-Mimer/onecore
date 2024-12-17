import React from 'react'
import { NavigationItem } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface ResidenceNavigationProps {
  residence: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function ResidenceNavigation({ residence, expanded: _, selected, onExpand, onSelect }: ResidenceNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(residence)
          onSelect(residence)
        }}
        isActive={selected === residence.id}
        tooltip={residence.name}
      >
        <Hotel />
        <span>{residence.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
