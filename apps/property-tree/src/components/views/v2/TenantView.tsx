import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTenant } from '@/components/hooks/useTenant'
import { useLeases } from '@/components/hooks/useLeases'
import { useRentalProperties } from '@/components/hooks/useRentalProperties'
import { TenantCard } from '@/components/tenants/TenantCard'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/components/hooks/useMobile'
import { TenantDetailTabs } from '@/components/tenants/tabs/TenantDetailTabs'
import { TenantDetailTabsContent } from '@/components/tenants/tabs/TenantDetailTabsContent'
import { TenantMobileAccordion } from '@/components/tenants/TenantMobileAccordion'
import type { Tenant } from '@/services/types'
import type { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'

// Helper component: Tenant header with name and special attention badge
function TenantHeader({ tenant }: { tenant: Tenant }) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold">
          {tenant.firstName} {tenant.lastName}
        </h1>
        {tenant.specialAttention && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-full border border-amber-200 cursor-help">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
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
  )
}

// Helper component: Tabs section with loading state handling
interface TenantTabsSectionProps {
  tenant: Tenant
  leases: Lease[] | undefined
  rentalProperties: Record<string, RentalPropertyInfo | null> | undefined
  leasesLoading: boolean
  leasesError: unknown
  rentalPropertiesLoading: boolean
  isMobile: boolean
}

function TenantTabsSection({
  tenant,
  leases,
  rentalProperties,
  leasesLoading,
  leasesError,
  rentalPropertiesLoading,
  isMobile,
}: TenantTabsSectionProps) {
  // Show error state for leases
  if (leasesError) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Kunde inte hämta kontrakt</h2>
            <p className="text-muted-foreground">
              Ett fel uppstod när kontrakten skulle hämtas
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isMobile) {
    return (
      <TenantMobileAccordion
        leases={leases ?? []}
        rentalProperties={rentalProperties ?? {}}
        contactCode={tenant.contactCode}
        customerName={`${tenant.firstName} ${tenant.lastName}`}
        isLoadingLeases={leasesLoading}
        isLoadingProperties={rentalPropertiesLoading}
      />
    )
  }

  return (
    <TenantDetailTabs>
      <TenantDetailTabsContent
        leases={leases ?? []}
        rentalProperties={rentalProperties ?? {}}
        personalNumber={tenant.nationalRegistrationNumber}
        contactCode={tenant.contactCode}
        customerName={`${tenant.firstName} ${tenant.lastName}`}
        isLoadingLeases={leasesLoading}
        isLoadingProperties={rentalPropertiesLoading}
      />
    </TenantDetailTabs>
  )
}

const TenantView = () => {
  const { contactCode } = useParams<{ contactCode: string }>()

  // Fetch tenant data
  const {
    data: tenant,
    isLoading: tenantLoading,
    error: tenantError,
  } = useTenant(contactCode)
  // Fetch leases data
  const {
    data: leases,
    isLoading: leasesLoading,
    error: leasesError,
  } = useLeases(contactCode)

  // Extract unique rental property IDs from leases
  const rentalPropertyIds = useMemo(() => {
    if (!leases) return []
    return leases.map((lease) => lease.rentalPropertyId)
  }, [leases])

  // Fetch rental properties data
  const {
    data: rentalProperties,
    isLoading: rentalPropertiesLoading,
    error: rentalPropertiesError,
  } = useRentalProperties(rentalPropertyIds)

  const isMobile = useIsMobile()

  // Let the PageLayout handle sidebar state based on route
  useEffect(() => {
    // Default sidebar state is handled in PageLayout based on route
  }, [isMobile])

  useEffect(() => {
    if (tenantError) {
      console.error('Error loading tenant data:', tenantError)
    }
  }, [tenantError])

  const renderContent = () => {
    // Show simple loading message while tenant data loads
    if (tenantLoading) {
      return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Hämtar hyresgäst...</p>
        </div>
      )
    }

    // Show error if tenant not found
    if (tenantError || !tenant) {
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

    // Render tenant header and card immediately
    return (
      <div className="w-full">
        <TenantHeader tenant={tenant} />
        <div className="grid grid-cols-1 gap-6 mb-6">
          <TenantCard tenant={tenant} />
        </div>
        <TenantTabsSection
          tenant={tenant}
          leases={leases}
          rentalProperties={rentalProperties}
          leasesLoading={leasesLoading}
          leasesError={leasesError}
          rentalPropertiesLoading={rentalPropertiesLoading}
          isMobile={isMobile}
        />
      </div>
    )
  }

  return renderContent()
}

export default TenantView
