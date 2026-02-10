import { Separator } from '@/shared/ui/Separator'
import { LeaseInfo } from '@/entities/lease'
import { TenantLeaseCard } from '@/entities/tenant'
import { TabLayout } from '@/shared/ui/TabLayout'
import { Lease } from '@/services/api/core/lease-service'

interface TenantsTabContentProps {
  isLoading: boolean
  error: Error | null
  lease: Lease | undefined
}

export function TenantsTabContent({
  isLoading,
  error,
  lease,
}: TenantsTabContentProps) {
  // Empty state when no lease
  if (!isLoading && !error && !lease) {
    return (
      <TabLayout title="Hyresgäst" showCard={true}>
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Ingen nuvarande kontraktsinnehavare
          </h2>
        </div>
      </TabLayout>
    )
  }

  return (
    <TabLayout
      title="Hyresgäst"
      showCard={true}
      isLoading={isLoading}
      error={error}
      errorMessage="Kontrakt hittades inte"
    >
      {lease && (
        <>
          <LeaseInfo lease={lease} />
          <div className="space-y-6">
            {lease.tenants?.map((tenant, i) => (
              <>
                {i > 0 && <Separator />}
                <TenantLeaseCard tenant={tenant} key={i} />
              </>
            ))}
          </div>
        </>
      )}
    </TabLayout>
  )
}
