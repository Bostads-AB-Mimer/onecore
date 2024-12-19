import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from '../ui/sidebar'
import { useQuery } from '@tanstack/react-query'
import { companyService } from '@/services/api'
import { CompanyNavigation } from './CompanyNavigation'
import { Sidebar } from 'lucide-react'

function CompanyNavigationLoader() {
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive text-center">
        <p>Failed to load companies</p>
      </div>
    )
  }

  if (!companies?.length) {
    return (
      <div className="p-4 text-muted-foreground text-center">
        <p>No companies found</p>
      </div>
    )
  }

  return (
    <>
      {companies.map((company) => (
        <CompanyNavigation key={company.id} company={company} />
      ))}
    </>
  )
}

export default function SidebarNavigation() {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <CompanyNavigationLoader />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}
