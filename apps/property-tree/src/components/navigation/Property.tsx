import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { BuildingList } from './BuildingList'

interface PropertyNavigationProps {
  property: Property
}

export function PropertyNavigation({ property }: PropertyNavigationProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/properties/${property.id}`)
        }}
        tooltip={property.designation}
      >
        <Building />
        <span>{property.designation}</span>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <BuildingList property={property} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
