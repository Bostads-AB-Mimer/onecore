import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Company } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { PropertyList } from './PropertyList'

interface CompanyNavigationProps {
  company: Company
}

export function CompanyNavigation({ company }: CompanyNavigationProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          navigate(`/companies/${company.id}`)
        }}
        tooltip={company.name}
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
