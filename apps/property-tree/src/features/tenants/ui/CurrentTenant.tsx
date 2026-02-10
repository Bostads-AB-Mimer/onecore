import { useQuery } from '@tanstack/react-query'
import { Separator } from '@/shared/ui/Separator'
import { LeaseInfo } from '@/entities/lease'
import { TenantLeaseCard } from '@/entities/tenant'
import { Grid } from '@/shared/ui/Grid'
import { TabLayout } from '@/shared/ui/TabLayout'
import { leaseService } from '@/services/api/core'
import type { Lease } from '@/services/api/core/lease-service'

interface CurrentTenantProps {
  rentalPropertyId: string
  leases?: Lease[]
  isLoading?: boolean
}

export function CurrentTenant({
  rentalPropertyId,
  leases: externalLeases,
  isLoading: externalIsLoading,
}: CurrentTenantProps) {
  // Only fetch if leases not provided from parent
  const leasesQuery = useQuery({
    queryKey: ['leases', rentalPropertyId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(rentalPropertyId, {
        includeContacts: true,
      }),
    enabled: !!rentalPropertyId && !externalLeases,
  })

  // Use external leases if provided, otherwise use query result
  const leases = externalLeases ?? leasesQuery.data
  const isLoading = externalIsLoading ?? leasesQuery.isLoading

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (leasesQuery.error || !leases) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Kontrakt hittades inte
        </h2>
      </div>
    )
  }

  const lease = leases.find((lease) => lease.status === 'Current')

  if (!lease) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Ingen nuvarande kontraktsinnehavare
        </h2>
      </div>
    )
  }

  return (
    <TabLayout showCard={true} showHeader={false}>
      <div className="pt-6 space-y-6">
        <LeaseInfo lease={lease} />
        <div className="space-y-6">
          {lease.tenants?.map((tenant, i) => (
            <div key={tenant.contactCode}>
              {i > 0 && <Separator />}
              <TenantLeaseCard tenant={tenant} />
            </div>
          ))}
        </div>
      </div>
    </TabLayout>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-in">
      <Grid cols={2}>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </Grid>
    </div>
  )
}
