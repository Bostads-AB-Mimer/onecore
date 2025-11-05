import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTenant } from '@/components/hooks/useTenant'
import { TenantCard } from '@/components/tenants/TenantCard'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { TriangleAlert } from 'lucide-react'
import { useIsMobile } from '@/components/hooks/useMobile'
// import { TenantDetailTabs } from '@/components/tenants/tabs/TenantDetailTabs'
// import { TenantDetailTabsContent } from '@/components/tenants/tabs/TenantDetailTabsContent'

const TenantView = () => {
  const { contactCode } = useParams<{ contactCode: string }>()

  // Fetch tenant data
  const { data: tenant, isLoading, error } = useTenant(contactCode)

  const isMobile = useIsMobile()

  // Let the PageLayout handle sidebar state based on route
  useEffect(() => {
    // Default sidebar state is handled in PageLayout based on route
  }, [isMobile])

  useEffect(() => {
    if (error) {
      console.error('Error loading tenant data:', error)
    }
  }, [error])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-6 py-4">
          <div className="h-8 bg-secondary rounded w-64"></div>
          <div className="h-4 bg-secondary rounded w-32 mt-2"></div>
          <div className="h-[200px] bg-secondary rounded mt-6"></div>
        </div>
      )
    }

    if (error || !tenant) {
      return (
        <div className="text-center py-10 space-y-4">
          <h2 className="text-2xl font-bold">Hyresgästen kunde inte hittas</h2>
          <p className="text-muted-foreground">
            Kontrollera kundnummret och försök igen
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Sökte efter: {contactCode}
          </p>
        </div>
      )
    }

    return (
      <div className="w-full">
        <TooltipProvider>
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold">
              {tenant.firstName} {tenant.lastName}
            </h1>
            {tenant.specialAttention && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-full border border-amber-200 cursor-help">
                    <TriangleAlert className="h-4 w-4 text-amber-600" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Åk aldrig ensam till kund. Ta alltid med dig en kollega vid
                    hembesök.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        <div className="grid grid-cols-1 gap-6 mb-6">
          <TenantCard tenant={tenant} />
        </div>

        {/* Implemented when we implement the various tabs in the view
        {isMobile ? (
          <TenantMobileAccordion
            contracts={contracts}
            hasActiveCases={hasActiveCases}
            customerNumber={tenant.personalNumber}
            customerName={`${tenant.firstName} ${tenant.lastName}`}
          />
        ) : (
          <TenantDetailTabs
            defaultValue="contracts"
            hasActiveCases={hasActiveCases}
          >
            <TenantDetailTabsContent
              contracts={contracts}
              personalNumber={tenant.personalNumber}
              customerNumber={tenant.personalNumber}
              customerName={`${tenant.firstName} ${tenant.lastName}`}
            />
          </TenantDetailTabs>
        )} */}
      </div>
    )
  }

  return renderContent()
}

export default TenantView
