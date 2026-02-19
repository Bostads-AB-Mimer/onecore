import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building } from 'lucide-react'

import { Property } from '@/services/types'

import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { toTitleCase } from '@/shared/lib/textUtils'
import { matchesRoute, paths, routes } from '@/shared/routes'
import { SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/Sidebar'

import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import { BuildingList } from './BuildingList'

interface PropertyNavigationProps {
  property: Property
  organizationNumber?: string
}

export function PropertyNavigation({
  property,
  organizationNumber,
}: PropertyNavigationProps) {
  const location = useLocation()
  const { isPropertyInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isPropertyInHierarchy(property.id)
  const isDirectlySelected =
    selectionState.selectedPropertyId === property.id &&
    matchesRoute(routes.property, location.pathname)

  const shouldAutoExpand = isInHierarchy || isDirectlySelected
  const [isExpanded, setIsExpanded] = React.useState(shouldAutoExpand)

  // Auto-expand when this property is in the selection hierarchy
  React.useEffect(() => {
    if (shouldAutoExpand) {
      setIsExpanded(true)
    }
  }, [shouldAutoExpand])

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isDirectlySelected,
    itemType: 'property',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton
        asChild
        tooltip={property.designation}
        isActive={isDirectlySelected}
        isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
      >
        <Link
          to={paths.property(property.id)}
          state={{ organizationNumber }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Building />
          <span>{toTitleCase(property.designation)}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <BuildingList
            property={property}
            organizationNumber={organizationNumber}
          />
        </div>
      )}
    </SidebarMenuItem>
  )
}
