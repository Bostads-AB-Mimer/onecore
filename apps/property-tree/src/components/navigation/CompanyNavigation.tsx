import React from 'react'
import { CompanyWithLinks, PropertyWithLinks } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyNavigation } from './PropertyNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface CompanyNavigationProps {
  company: CompanyWithLinks
  selected: string | null
  onSelect: (company: CompanyWithLinks) => void
}

export function CompanyNavigation({
  company,
  selected,
  onSelect,
}: CompanyNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const {
    data: properties,
    loading,
    error,
  } = useAsync(async () => {
    if (isExpanded) {
      if (!company._links?.properties?.href) {
        throw new Error('Company is missing properties link')
      }
      const response = await fetchApi<{ content: PropertyWithLinks[] }>(
        company._links.properties.href
      )
      console.log('response', response)
      return response.content
    }
    return []
  }, [isExpanded])

  if (loading && isExpanded) {
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
        <span>{company.name}</span>
      </SidebarMenuButton>
      {isExpanded && properties && properties.length > 0 && (
        <SidebarMenu>
          {properties.map((property) => (
            <PropertyNavigation
              key={property.id}
              property={property}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
