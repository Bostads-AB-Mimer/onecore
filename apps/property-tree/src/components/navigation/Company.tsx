import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Company } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { PropertyList } from './PropertyList'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/components/hooks/useScrollToSelected'
import { useCompanyExpansion } from './CompanyExpansionContext'

interface CompanyNavigationProps {
  company: Company
}

export function CompanyNavigation({ company }: CompanyNavigationProps) {
  const location = useLocation()
  const { isCompanyInHierarchy, selectionState } = useHierarchicalSelection()
  const { expandedCompanyCodes } = useCompanyExpansion()

  const isInHierarchy = isCompanyInHierarchy(company.id)
  const isDirectlySelected =
    selectionState.selectedCompanyId === company.id &&
    location.pathname.startsWith('/companies/')

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
          to={`/companies/${company.id}`}
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
