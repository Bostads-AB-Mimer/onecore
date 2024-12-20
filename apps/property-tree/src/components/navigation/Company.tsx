import React from 'react'
import { Company } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyList } from './PropertyList'
import { useNavigation } from '@/contexts/NavigationContext'

interface CompanyNavigationProps {
  company: Company
  onSelect: () => void
}

export function CompanyNavigation({ company, onSelect }: CompanyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const { selectedCompany } = useNavigation()
  const isSelected = selectedCompany?.id === company.id

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSelect()
        }}
        isActive={isSelected}
        tooltip={company.name}
      >
        <Building2 />
        <span>{company.name.replace('** TEST **', '')}</span>
      </SidebarMenuButton>
      {isExpanded && <PropertyList company={company} />}
    </SidebarMenuItem>
  )
}
