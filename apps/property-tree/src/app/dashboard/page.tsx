import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { useQuery } from '@tanstack/react-query'
import { companyService, propertyService, buildingService, residenceService } from '@/services/api'
import { CompanyNavigation } from '@/components/navigation/Company'
import { PropertyNavigation } from '@/components/navigation/Property'
import { BuildingNavigation } from '@/components/navigation/Building'
import { StaircaseNavigation } from '@/components/navigation/Staircase'
import { ResidenceNavigation } from '@/components/navigation/Residence'
import { NavigationProvider } from '@/contexts/NavigationContext'

export default function Page() {
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.getAll()
  })

  return (
    <NavigationProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Navigation Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col gap-8 p-8">
            {isLoadingCompanies ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-56" />
              </div>
            ) : (
              companies?.map(company => (
                <div key={company.id} className="flex flex-col gap-4">
                  <CompanyNavigation company={company} onSelect={() => {}} />
                  <div className="ml-8">
                    <PropertyList company={company} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
  )
}
