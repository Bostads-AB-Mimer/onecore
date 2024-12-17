import React from 'react'
import { NavigationItem } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyNavigation } from './PropertyNavigation'
import { fetchApi } from '@/services/api/baseApi'

interface CompanyNavigationProps {
  company: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function CompanyNavigation({ company, expanded, selected, onExpand, onSelect }: CompanyNavigationProps) {
  const [properties, setProperties] = React.useState<NavigationItem[]>([])

  // Load properties when company is expanded
  React.useEffect(() => {
    if (expanded.has(company.id) && properties.length === 0) {
      const loadProperties = async () => {
        try {
          const response = await fetchApi<{ content: NavigationItem[] }>(company._links.properties.href)
          setProperties(response.content.map(property => ({
            id: property.id,
            name: property.propertyDesignation?.name || property.code,
            type: 'property' as const,
            _links: property._links,
            children: []
          })))
        } catch (err) {
          console.error(`Failed to load properties for company ${company.id}:`, err)
        }
      }
      loadProperties()
    }
  }, [company, expanded, properties.length])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(company)
          onSelect(company)
        }}
        isActive={selected === company.id}
      >
        <Building2 />
        <span>{company.name}</span>
      </SidebarMenuButton>
      {expanded.has(company.id) && properties.length > 0 && (
        <SidebarMenu>
          {properties.map(property => (
            <PropertyNavigation
              key={property.id}
              property={property}
              expanded={expanded}
              selected={selected}
              onExpand={onExpand}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
