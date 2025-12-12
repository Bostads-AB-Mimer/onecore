import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Property } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { BuildingList } from './BuildingList'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/components/hooks/useScrollToSelected'
import { toTitleCase } from '@/lib/text-utils'

interface PropertyNavigationProps {
  property: Property
  companyId?: string
}

export function PropertyNavigation({
  property,
  companyId,
}: PropertyNavigationProps) {
  const navigate = useNavigate()
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
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/properties/${property.id}`, {
            state: {
              companyId: companyId,
            },
          })
        }}
        tooltip={property.designation}
        isActive={isDirectlySelected}
        isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
      >
        <Building />
        <span>{toTitleCase(property.designation)}</span>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <BuildingList property={property} companyId={companyId} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
