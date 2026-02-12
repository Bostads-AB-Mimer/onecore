import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/shared/ui/Sidebar'
import { BuildingList } from './BuildingList'
import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { toTitleCase } from '@/shared/lib/textUtils'

interface PropertyNavigationProps {
  property: Property
  companyId?: string
}

export function PropertyNavigation({
  property,
  companyId,
}: PropertyNavigationProps) {
  const location = useLocation()
  const { isPropertyInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isPropertyInHierarchy(property.id)
  const isDirectlySelected =
    selectionState.selectedPropertyId === property.id &&
    location.pathname.startsWith('/properties/')

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
          to={`/properties/${property.id}`}
          state={{ companyId }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Building />
          <span>{toTitleCase(property.designation)}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <BuildingList property={property} companyId={companyId} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
