import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/Skeleton'
import { companyService } from '@/services/api'
import { CompanyNavigation } from './Company'
import { SidebarGroup, SidebarMenu } from '@/components/ui/Sidebar'

export function CompanyList() {
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
    <SidebarMenu>
      {companies?.map((company) => (
        <CompanyNavigation key={company.id} company={company} />
      ))}
    </SidebarMenu>
  )
}
