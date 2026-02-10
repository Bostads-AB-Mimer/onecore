import { CompanyNavigation } from './Company'
import { SidebarMenu } from '@/shared/ui/Sidebar'
import { NavigationSkeleton } from './NavigationSkeleton'
import { NavigationError } from './NavigationError'
import { useCompanies } from '@/features/companies'

export function CompanyList() {
  const { data: companies, isLoading, error } = useCompanies()

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="companies" />

  // Filter to only show companies 001 (BOSTADS AB MIMER) and 006 (BJÖRNKLOCKAN)
  const visibleCompanies = companies?.filter(
    (company) => company.code === '001' || company.code === '006'
  )

  return (
    <SidebarMenu>
      {visibleCompanies?.map((company) => (
        <CompanyNavigation key={company.id} company={company} />
      ))}
    </SidebarMenu>
  )
}
