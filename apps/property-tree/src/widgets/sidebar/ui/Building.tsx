import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Warehouse } from 'lucide-react'

import { Building, Property } from '@/services/types'

import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { matchesRoute, paths, routes } from '@/shared/routes'
import { SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/Sidebar'

import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import { ResidenceList } from './ResidenceList'

interface BuildingNavigationProps {
  building: Building
  property: Property
  organizationNumber?: string
}

export function BuildingNavigation({
  building,
  property,
  organizationNumber,
}: BuildingNavigationProps) {
  const location = useLocation()
  const { isBuildingInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isBuildingInHierarchy(
    building.code,
    property.id,
    building.id
  )
  const isDirectlySelected =
    selectionState.selectedBuildingCode === building.code &&
    matchesRoute(routes.building, location.pathname)

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
          to={paths.building(building.code)}
          state={{
            propertyId: property.id,
            buildingCode: building.code,
            organizationNumber,
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
            organizationNumber={organizationNumber}
          />
        </div>
      )}
    </SidebarMenuItem>
  )
}
