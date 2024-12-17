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
