import React from 'react'
import { Building, Property } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { ResidenceList } from './ResidenceList'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import { useNavigate, useLocation } from 'react-router-dom'
import { useScrollToSelected } from '@/components/hooks/useScrollToSelected'

interface BuildingNavigationProps {
  building: Building
  property: Property
  companyId?: string
}

export function BuildingNavigation({ building, property, companyId }: BuildingNavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isExpanded, setIsExpanded] = React.useState(false)
  const { isBuildingInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isBuildingInHierarchy(building.code, property.id, building.id)
  const isDirectlySelected = selectionState.selectedBuildingId === building.id &&
                            location.pathname.startsWith('/buildings/')

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isDirectlySelected || (isInHierarchy && !isDirectlySelected)
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <div className="flex items-center justify-between pr-2">
        <SidebarMenuButton
          onClick={() => {
            setIsExpanded(!isExpanded)
            navigate(`/buildings/${building.id}`, {
              state: {
                propertyId: property.id,
                buildingCode: building.code,
                companyId: companyId,
              },
            })
          }}
          tooltip={building.code}
          isActive={isDirectlySelected}
          isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
        >
          <Warehouse />
          <span>{building.code}</span>
        </SidebarMenuButton>
      </div>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList building={building} propertyId={property.id} companyId={companyId} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
