import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Company } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { PropertyList } from './PropertyList'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/components/hooks/useScrollToSelected'

interface CompanyNavigationProps {
  company: Company
}

export function CompanyNavigation({ company }: CompanyNavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isCompanyInHierarchy, selectionState } = useHierarchicalSelection()

  const isInHierarchy = isCompanyInHierarchy(company.id)
  const isDirectlySelected =
    selectionState.selectedCompanyId === company.id &&
    location.pathname.startsWith('/companies/')

  const shouldAutoExpand = isInHierarchy || isDirectlySelected
  const [isExpanded, setIsExpanded] = React.useState(shouldAutoExpand)

  // Auto-expand when this company is in the selection hierarchy
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
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/companies/${company.id}`)
        }}
        tooltip={company.name}
        isActive={isDirectlySelected}
        isSelectedInHierarchy={isInHierarchy && !isDirectlySelected}
      >
        <Building2 />
        <span>{company.name.replace('** TEST **', '')}</span>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <PropertyList company={company} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
