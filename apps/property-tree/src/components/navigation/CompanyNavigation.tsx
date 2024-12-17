import React from 'react'
import { NavigationItem } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyNavigation } from './PropertyNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface CompanyNavigationProps {
  company: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

/**
 * Komponent för att visa företagsnivån i navigeringen
 * Hanterar lazy loading av properties när företaget expanderas
 */
export function CompanyNavigation({ company, expanded, selected, onExpand, onSelect }: CompanyNavigationProps) {
  // Använd useAsync för att hantera laddning av properties
  const { data: properties, loading, error } = useAsync(async () => {
    if (expanded.has(company.id)) {
      const response = await fetchApi<{ content: NavigationItem[] }>(company._links.properties.href)
      return response.content.map(property => ({
        id: property.id,
        name: property.propertyDesignation?.name || property.code,
        type: 'property' as const,
        _links: property._links,
        children: []
      }))
    }
    return []
  }, [company.id, expanded])

  // Visa laddningsindikator
  if (loading && expanded.has(company.id)) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  // Visa felmeddelande om något gick fel
  if (error) {
    console.error(`Failed to load properties for company ${company.id}:`, error)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(company)
          onSelect(company)
        }}
        isActive={selected === company.id}
        tooltip={company.name}
      >
        <Building2 />
        <span>{company.name}</span>
      </SidebarMenuButton>
      {expanded.has(company.id) && properties && properties.length > 0 && (
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
