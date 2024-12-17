import React from 'react'
import { NavigationItem } from '@/services/types'
import { Building2, Loader2 } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyItems } from './PropertyItems'
import { motion } from 'framer-motion'
import { fetchApi } from '@/services/api/baseApi'

export function CompanyNavigation() {
  const [items, setItems] = React.useState<NavigationItem[]>([])
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [selected, setSelected] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Load companies when component mounts
  React.useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await fetchApi<{ content: NavigationItem[] }>('/companies')
        setItems(response.content)
      } catch (err) {
        setError('Kunde inte ladda företag')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
  }, [])

  // Handle expanding/collapsing nodes
  const handleExpand = async (item: NavigationItem) => {
    if (!expanded.has(item.id)) {
      try {
        const response = await fetchApi<{ content: NavigationItem[] }>(item._links.properties.href)
        setItems(current => {
          const updateChildren = (items: NavigationItem[]): NavigationItem[] => {
            return items.map(i => {
              if (i.id === item.id) {
                return { 
                  ...i, 
                  children: response.content.map(property => ({
                    id: property.id,
                    name: property.propertyDesignation?.name || property.code,
                    type: 'property' as const,
                    _links: property._links,
                    children: []
                  }))
                }
              }
              if (i.children) {
                return { ...i, children: updateChildren(i.children) }
              }
              return i
            })
          }
          return updateChildren(current)
        })
      } catch (err) {
        console.error(`Failed to load properties for company ${item.id}:`, err)
      }
    }
    
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }
      return next
    })
  }

  const handleSelect = (item: NavigationItem) => {
    setSelected(item.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </div>
    )
  }

  if (error) {
    return <div className="px-2 py-1 text-sm text-destructive">{error}</div>
  }

  return items.map(item => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => {
          handleExpand(item)
          handleSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Building2 />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {expanded.has(item.id) && item.children && (
        <PropertyItems
          properties={item.children}
          expanded={expanded}
          selected={selected}
          onExpand={handleExpand}
          onSelect={handleSelect}
        />
      )}
    </SidebarMenuItem>
  ))
}
