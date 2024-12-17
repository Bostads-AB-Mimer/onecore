import { NavigationItem } from '@/services/types'
import { Building2, Loader2 } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyItems } from './PropertyItems'
import { useState } from 'react'
import { companyService } from '@/services/api'
import { motion } from 'framer-motion'

interface CompanyNavigationProps {
  item: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function CompanyNavigation({ item, expanded, selected, onExpand, onSelect }: CompanyNavigationProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<NavigationItem[]>([])

  const handleExpand = async () => {
    if (!expanded.has(item.id) && !properties.length) {
      setLoading(true)
      setError(null)
      try {
        const response = await companyService.getCompanyProperties(item)
        setProperties(response.content.map(property => ({
          id: property.id,
          name: property.propertyDesignation?.name || property.code,
          type: 'property' as const,
          _links: property._links,
          children: []
        })))
      } catch (err) {
        console.error('Failed to load properties:', err)
        setError('Kunde inte ladda fastigheter')
      } finally {
        setLoading(false)
      }
    }
    onExpand(item)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          handleExpand()
          onSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Building2 />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {expanded.has(item.id) && (
        <SidebarMenu>
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>
          ) : error ? (
            <div className="px-2 py-1 text-sm text-destructive">{error}</div>
          ) : (
            <PropertyItems
              properties={properties}
              expanded={expanded}
              selected={selected}
              onExpand={onExpand}
              onSelect={onSelect}
            />
          )}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
