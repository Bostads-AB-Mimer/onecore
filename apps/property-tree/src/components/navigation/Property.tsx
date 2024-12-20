import React from 'react'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface PropertyNavigationProps {
  property: Property
  onSelect?: () => void
}

export function PropertyNavigation({
  property,
  onSelect,
}: PropertyNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onSelect}
        tooltip={property.designation}
      >
        <Building />
        <span>{property.designation}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
