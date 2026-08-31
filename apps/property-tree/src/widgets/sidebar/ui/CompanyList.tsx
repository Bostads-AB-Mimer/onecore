import { useCompanies } from '@/features/companies'

import { Company } from '@/services/types'

import { NavigationError, NavigationSkeleton } from '@/shared/ui/layout'
import { SidebarMenu } from '@/shared/ui/Sidebar'

import { CompanyNavigation } from './Company'

export function CompanyList() {
  const { data: companies, isLoading, error } = useCompanies()

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="companies" />

  // Filter to only show companies 001 (BOSTADS AB MIMER) and 006 (BJÖRNKLOCKAN)
  // Also exclude companies without organizationNumber (test companies)
  const visibleCompanies = companies?.filter(
    (company): company is Company & { organizationNumber: string } =>
      (company.code === '001' || company.code === '006') &&
      company.organizationNumber !== null
  )

  return (
    <SidebarMenu>
      {visibleCompanies?.map((company) => (
        <CompanyNavigation key={company.organizationNumber} company={company} />
      ))}
    </SidebarMenu>
  )
}
