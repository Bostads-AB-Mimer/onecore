import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DoorOpen } from 'lucide-react'

import { Building, Staircase } from '@/services/types'

import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { toTitleCase } from '@/shared/lib/textUtils'
import { matchesRoute, paths, routes } from '@/shared/routes'
import { SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/Sidebar'

import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import { ResidenceList } from './ResidenceList'

interface StaircaseNavigationProps {
  staircase: Staircase
  building: Building
  propertyCode?: string
  organizationNumber?: string
}

export function StaircaseNavigation({
  staircase,
  building,
  propertyCode,
  organizationNumber,
}: StaircaseNavigationProps) {
  const location = useLocation()
  const { isStaircaseInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isStaircaseInHierarchy(staircase.code)
  const isDirectlySelected =
    selectionState.selectedStaircaseCode === staircase.code &&
    matchesRoute(routes.staircase, location.pathname)

  const shouldAutoExpand = isInHierarchy || isDirectlySelected
  const [isExpanded, setIsExpanded] = React.useState(shouldAutoExpand)

  React.useEffect(() => {
    if (shouldAutoExpand) {
      setIsExpanded(true)
    }
  }, [shouldAutoExpand])

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isDirectlySelected,
    itemType: 'staircase',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton
        asChild
        tooltip={staircase.name || staircase.code}
        isActive={isDirectlySelected}
        isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
      >
        <Link
          to={paths.staircase(building.code, staircase.code)}
          state={{
            propertyCode,
            buildingCode: building.code,
            staircaseCode: staircase.code,
            organizationNumber,
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <DoorOpen />
          <span>{toTitleCase(staircase.name ?? staircase.code)}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList
            building={building}
            staircaseCode={staircase.code}
            propertyCode={propertyCode}
            organizationNumber={organizationNumber}
          />
        </div>
      )}
    </SidebarMenuItem>
  )
}
