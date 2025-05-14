import { useQuery } from '@tanstack/react-query'

import { leaseService } from '@/services/api/core'
import { Separator } from '../ui/v2/Separator'
import { LeaseInfo } from './LeaseInfo'
import { TenantCard } from './TenantCard'
import { Grid } from '../ui/Grid'
interface Props {
  rentalPropertyId: string
}

export function TenantInformation(props: Props) {
  const leasesQuery = useQuery({
    queryKey: ['rooms', props.rentalPropertyId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(props.rentalPropertyId, {
        includeContacts: true,
      }),
  })

  if (leasesQuery.isLoading) {
    return <LoadingSkeleton />
  }

  if (leasesQuery.error || !leasesQuery.data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Kontrakt hittades inte
        </h2>
      </div>
    )
  }

  const lease = leasesQuery.data.find((lease) => lease.status === 'Current')

  if (!lease) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Kontrakt hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <LeaseInfo
        primaryContractNumber={lease.leaseId}
        isSecondaryRental={false}
      />
      <div className="space-y-6">
        {lease.tenants?.concat(lease.tenants).map((tenant, i) => (
          <>
            {i > 0 && <Separator />}
            <TenantCard lease={lease} tenant={tenant} key={i} />
          </>
        ))}
      </div>
    </div>
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
