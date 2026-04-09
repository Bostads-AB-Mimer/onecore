import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { RentalPropertyInfo } from '@onecore/types'
import { AlertTriangle } from 'lucide-react'

import { TenantTabs } from '@/widgets/tenant-tabs'

import { useLeasesByContactCode } from '@/entities/lease'
import { useRentalProperties } from '@/entities/rental-property'
import { TenantCard, useTenant } from '@/entities/tenant'

import type { Lease } from '@/services/api/core/leaseService'
import type { Tenant } from '@/services/types'

import { tenantService } from '@/services/api/core/tenantService'

import { useSingleEmail, useSingleSms } from '@/shared/hooks'
import { Card, CardContent } from '@/shared/ui/Card'
import { EmailModal } from '@/shared/ui/EmailModal'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { SmsModal } from '@/shared/ui/SmsModal'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/Tooltip'

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
}

function TenantTabsSection({
  tenant,
  leases,
  rentalProperties,
  leasesLoading,
  leasesError,
  rentalPropertiesLoading,
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

  return (
    <TenantTabs
      leases={leases ?? []}
      rentalProperties={rentalProperties ?? {}}
      contactCode={tenant.contactCode}
      tenantName={`${tenant.firstName} ${tenant.lastName}`}
      isLoadingLeases={leasesLoading}
      isLoadingProperties={rentalPropertiesLoading}
    />
  )
}

export function TenantPage() {
  const { contactCode } = useParams<{ contactCode: string }>()
  const sms = useSingleSms({ sendSms: tenantService.sendBulkSms })
  const email = useSingleEmail({ sendEmail: tenantService.sendBulkEmail })

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
  } = useLeasesByContactCode(contactCode)

  // Extract unique rental property IDs from leases
  const rentalPropertyIds = useMemo(() => {
    if (!leases) return []
    return leases.map((lease) => lease.rentalPropertyId)
  }, [leases])

  // Fetch rental properties data
  const { data: rentalProperties, isLoading: rentalPropertiesLoading } =
    useRentalProperties(rentalPropertyIds)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={tenantLoading}
        error={tenantError}
        data={tenant}
        notFoundMessage="Hyresgästen kunde inte hittas"
        searchedFor={contactCode}
      >
        {(tenant) => (
          <>
            <TenantHeader tenant={tenant} />
            <div className="grid grid-cols-1 gap-6 mb-6">
              <TenantCard
                tenant={tenant}
                onSendSms={(phone) =>
                  sms.openSmsModal(
                    `${tenant.firstName} ${tenant.lastName}`,
                    phone
                  )
                }
                onSendEmail={(addr) =>
                  email.openEmailModal(
                    `${tenant.firstName} ${tenant.lastName}`,
                    addr
                  )
                }
              />
            </div>
            <TenantTabsSection
              tenant={tenant}
              leases={leases}
              rentalProperties={rentalProperties}
              leasesLoading={leasesLoading}
              leasesError={leasesError}
              rentalPropertiesLoading={rentalPropertiesLoading}
            />
            <SmsModal
              open={sms.smsModalOpen}
              onOpenChange={sms.onOpenChange}
              recipientName={sms.smsRecipientName}
              phoneNumber={sms.smsPhoneNumber}
              onSend={sms.handleSendSms}
            />
            <EmailModal
              open={email.emailModalOpen}
              onOpenChange={email.onOpenChange}
              recipientName={email.emailRecipientName}
              emailAddress={email.emailAddress}
              onSend={email.handleSendEmail}
            />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
