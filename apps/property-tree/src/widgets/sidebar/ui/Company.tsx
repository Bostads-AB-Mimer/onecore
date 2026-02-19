import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2 } from 'lucide-react'

import { Company } from '@/services/types'

import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { matchesRoute, paths, routes } from '@/shared/routes'
import { SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/Sidebar'

import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import { useCompanyExpansion } from './CompanyExpansionContext'
import { PropertyList } from './PropertyList'

interface CompanyNavigationProps {
  company: Company
}

export function CompanyNavigation({ company }: CompanyNavigationProps) {
  const location = useLocation()
  const { isCompanyInHierarchy, selectionState } = useHierarchicalSelection()
  const { expandedCompanyCodes } = useCompanyExpansion()

  const isInHierarchy = isCompanyInHierarchy(company.organizationNumber!)
  const isDirectlySelected =
    selectionState.selectedOrganizationNumber === company.organizationNumber &&
    matchesRoute(routes.company, location.pathname)

  // Check if this company should be expanded via context
  const isRequestedToExpand = expandedCompanyCodes.has(company.code)

  const shouldAutoExpand =
    isInHierarchy || isDirectlySelected || isRequestedToExpand
  const [isExpanded, setIsExpanded] = React.useState(shouldAutoExpand)

  // Auto-expand when requested via context or hierarchy selection
  React.useEffect(() => {
    if (shouldAutoExpand) {
      setIsExpanded(true)
    }
  }, [shouldAutoExpand])

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isDirectlySelected,
    itemType: 'company',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton
        asChild
        tooltip={company.name}
        isActive={isDirectlySelected}
        isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
      >
        <Link
          to={paths.company(company.organizationNumber!)}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Building2 />
          <span>{company.name.replace('** TEST **', '')}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <PropertyList company={company} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
