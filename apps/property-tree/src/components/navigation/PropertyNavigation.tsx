import React from 'react'
import { NavigationItem } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenu } from '../ui/sidebar'
import { BuildingNavigation } from './BuildingNavigation'
import { useAsync } from '@/hooks/use-async'
import { fetchApi } from '@/services/api/baseApi'

interface PropertyNavigationProps {
  property: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function PropertyNavigation({ property, expanded, selected, onExpand, onSelect }: PropertyNavigationProps) {
  const { data: buildings, loading, error } = useAsync(async () => {
    if (expanded.has(property.id)) {
      if (!property._links?.buildings?.href) {
        throw new Error('Property is missing buildings link')
      }
      const response = await fetchApi<{ content: NavigationItem[] }>(property._links.buildings.href)
      return response.content.map(building => ({
        id: building.id,
        name: building.name || building.code,
        type: 'building' as const,
        _links: building._links,
        children: []
      }))
    }
    return []
  }, [property.id, expanded])

  // Visa laddningsindikator
  if (loading && expanded.has(property.id)) {
    return (
      <SidebarMenuItem>
        <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
      </SidebarMenuItem>
    )
  }

  // Visa felmeddelande om något gick fel
  if (error) {
    console.error(`Failed to load buildings for property ${property.id}:`, error)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(property)
          onSelect(property)
        }}
        isActive={selected === property.id}
      >
        <Building />
        <span>{property.name}</span>
      </SidebarMenuButton>
      {expanded.has(property.id) && buildings.length > 0 && (
        <SidebarMenu>
          {buildings.map(building => (
            <BuildingNavigation
              key={building.id}
              building={building}
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
import React from 'react'
import { Loader2 } from 'lucide-react'
import { CompanyNavigation } from './CompanyNavigation'
import { motion } from 'framer-motion'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from '../ui/sidebar'
import { useNavigation } from '@/hooks/use-navigation'
import { companyService } from '@/services/api'
import { NavigationItem } from '@/services/types'

export function PropertyNavigation() {
  const [items, setItems] = React.useState<NavigationItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { expanded, selected, handleExpand, handleSelect } = useNavigation()

  // Load companies when component mounts
  React.useEffect(() => {
    const loadCompanies = async () => {
      try {
        const companies = await companyService.getAll()
        setItems(
          companies.map(company => ({
            id: company.id,
            name: company.name,
            type: 'company' as const,
            _links: company._links,
            children: []
          }))
        )
      } catch (err) {
        setError('Could not load companies')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-6 w-6 text-blue-500" />
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-center">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar className="w-64">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(company => (
                  <CompanyNavigation
                    key={company.id}
                    company={company}
                    expanded={expanded}
                    selected={selected}
                    onExpand={handleExpand}
                    onSelect={handleSelect}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}
