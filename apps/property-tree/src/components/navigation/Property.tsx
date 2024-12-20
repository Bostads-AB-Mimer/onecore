import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { BuildingList } from './BuildingList'
import { useNavigation } from '@/contexts/NavigationContext'
import { Avatar } from '../ui/avatar'

interface PropertyNavigationProps {
  property: Property
}

export function PropertyNavigation({ property }: PropertyNavigationProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = React.useState(false)
  const { selectedProperty } = useNavigation()
  const isSelected = selectedProperty?.id === property.id

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/properties/${property.id}`)
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
