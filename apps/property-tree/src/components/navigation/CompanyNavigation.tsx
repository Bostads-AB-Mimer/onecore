import React from 'react'
import { CompanyWithLinks } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { useNavigation } from '@/hooks/use-navigation-context'
import { PropertyNavigation } from './PropertyNavigation'
import { useQuery } from '@tanstack/react-query'
import { companyService } from '@/services/api'
import { GET } from '@/services/api/baseApi'

interface CompanyNavigationProps {
  company: CompanyWithLinks
}

export function CompanyNavigation({ company }: CompanyNavigationProps) {
  const { selectedId: selected, selectItem: onSelect } = useNavigation()
  const [isExpanded, setIsExpanded] = React.useState(false)

  const {
    data: properties,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['propertiesForCompanyId', company.id],
    queryFn: async () => {
      const { data, error } = await GET('/companies/{companyId}/properties', {
        params: { path: { companyId: company.id } }
      })
      if (error) throw error
      return data?.content
    },
  })

  if (isLoading && isExpanded) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  if (error) {
    console.error(`Failed to load properties for company ${company.id}:`, error)
    return (
      <SidebarMenuItem>
        <div className="text-sm text-destructive px-2">
          Failed to load properties
        </div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSelect(company)
        }}
        isActive={selected === company.id}
        tooltip={company.name}
      >
        <Building2 />
        <span>{company.name.replace('** TEST **', '')}</span>
      </SidebarMenuButton>
      {properties && isExpanded && (
        <SidebarMenu>
          {properties.map((property) => (
            <PropertyNavigation key={property.id} property={property} />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
