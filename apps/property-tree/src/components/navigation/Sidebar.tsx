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
import { fetchApi } from '@/services/api/baseApi'

interface NavigationItem {
  id: string
  name: string
  type: 'company' | 'property' | 'building' | 'staircase' | 'residence'
  _links: Record<string, { href: string }>
  children?: NavigationItem[]
}

export function PropertyNavigation() {
  const [items, setItems] = React.useState<NavigationItem[]>([])
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [selected, setSelected] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Ladda företag när komponenten monteras
  React.useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await fetchApi<{ content: NavigationItem[] }>(
          '/companies'
        )
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

  // Ladda underliggande nivå när en nod expanderas
  const handleExpand = async (item: NavigationItem) => {
    if (!expanded.has(item.id)) {
      try {
        let childrenUrl: string | undefined

        switch (item.type) {
          case 'company':
            childrenUrl = item._links.properties?.href
            break
          case 'property':
            childrenUrl = item._links.buildings?.href
            break
          case 'building':
            childrenUrl = item._links.staircases?.href
            break
          case 'staircase':
            childrenUrl = item._links.residences?.href
            break
        }

        if (childrenUrl) {
          const response = await fetchApi<{ content: NavigationItem[] }>(
            childrenUrl
          )
          setItems((current) => {
            const updateChildren = (
              items: NavigationItem[]
            ): NavigationItem[] => {
              return items.map((i) => {
                if (i.id === item.id) {
                  return { ...i, children: response.content }
                }
                if (i.children) {
                  return { ...i, children: updateChildren(i.children) }
                }
                return i
              })
            }
            return updateChildren(current)
          })
        }
      } catch (err) {
        console.error(`Kunde inte ladda barn för ${item.type} ${item.id}:`, err)
      }
    }

    setExpanded((current) => {
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
                {items.map((item) => (
                  <CompanyNavigation
                    key={item.id}
                    item={item}
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
