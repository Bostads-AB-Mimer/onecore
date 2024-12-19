import React from 'react'
import { Residence } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface ResidenceNavigationProps {
  residence: Residence
}

export function ResidenceNavigation({ residence }: ResidenceNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={residence.name}>
        <Hotel />
        <span>LGH-{residence.code}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
