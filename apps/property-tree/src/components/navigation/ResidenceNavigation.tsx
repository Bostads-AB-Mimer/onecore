import React from 'react'
import { NavigationItem } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface ResidenceNavigationProps {
  residence: NavigationItem
  selected: string | null
  onSelect: (item: NavigationItem) => void
}

export function ResidenceNavigation({ residence, selected, onSelect }: ResidenceNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => onSelect(residence)}
        isActive={selected === residence.id}
        tooltip={residence.name}
      >
        <Hotel />
        <span>{residence.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
