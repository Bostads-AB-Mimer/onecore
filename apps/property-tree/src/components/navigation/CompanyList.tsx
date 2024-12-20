import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from '../ui/skeleton'
import { companyService } from '@/services/api'
import { CompanyNavigation } from './Company'
import { useNavigation } from '@/contexts/NavigationContext'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from '../ui/sidebar'

export function CompanyList() {
  const { setSelectedCompany, clearSelection } = useNavigation()

  const {
    data: companies,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.getAll(),
  })

  if (isLoading) {
    return (
      <SidebarGroup>
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2" />
      </SidebarGroup>
    )
  }

  if (error) {
    console.error('Failed to load companies:', error)
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load companies
      </div>
    )
  }

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          Companies
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {companies?.map((company) => (
                <CompanyNavigation
                  key={company.id}
                  company={company}
                  onSelect={() => {
                    clearSelection()
                    setSelectedCompany(company)
                  }}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
