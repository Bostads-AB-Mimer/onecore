import React from 'react'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { BuildingList } from './BuildingList'
import { useNavigation } from '@/contexts/NavigationContext'

interface PropertyNavigationProps {
  property: Property
  onSelect: () => void
}

export function PropertyNavigation({ property, onSelect }: PropertyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const { selectedProperty } = useNavigation()
  const isSelected = selectedProperty?.id === property.id

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSelect()
        }}
        isActive={isSelected}
        tooltip={property.designation}
      >
        <Building />
        <span>{property.designation}</span>
      </SidebarMenuButton>
      {isExpanded && <BuildingList property={property} />}
    </SidebarMenuItem>
  )
}
