import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building, Property } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { ResidenceList } from './ResidenceList'
import { useHierarchicalSelection } from '@/hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/hooks/useScrollToSelected'

interface BuildingNavigationProps {
  building: Building
  property: Property
  companyId?: string
}

export function BuildingNavigation({
  building,
  property,
  companyId,
}: BuildingNavigationProps) {
  const location = useLocation()
  const { isBuildingInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isBuildingInHierarchy(
    building.code,
    property.id,
    building.id
  )
  const isDirectlySelected =
    selectionState.selectedBuildingId === building.id &&
    location.pathname.startsWith('/buildings/')

  const shouldAutoExpand = isInHierarchy || isDirectlySelected
  const [isExpanded, setIsExpanded] = React.useState(shouldAutoExpand)

  React.useEffect(() => {
    if (shouldAutoExpand) {
      setIsExpanded(true)
    }
  }, [shouldAutoExpand])

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isDirectlySelected,
    itemType: 'building',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton
        asChild
        tooltip={building.code}
        isActive={isDirectlySelected}
        isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
      >
        <Link
          to={`/buildings/${building.id}`}
          state={{
            propertyId: property.id,
            buildingCode: building.code,
            companyId,
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Warehouse />
          <span>{building.code}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList
            building={building}
            propertyId={property.id}
            companyId={companyId}
          />
        </div>
      )}
    </SidebarMenuItem>
  )
}
