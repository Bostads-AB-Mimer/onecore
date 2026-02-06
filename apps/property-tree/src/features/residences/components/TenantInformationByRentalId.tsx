import { useQuery } from '@tanstack/react-query'
import { leaseService } from '@/services/api/core'
import { TenantInformation } from './TenantInformation'

interface Props {
  rentalPropertyId: string
}

export function TenantInformationByRentalId({ rentalPropertyId }: Props) {
  const leasesQuery = useQuery({
    queryKey: ['leases', rentalPropertyId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(rentalPropertyId, {
        includeContacts: true,
      }),
    enabled: !!rentalPropertyId,
  })

  return (
    <TenantInformation
      isLoading={leasesQuery.isLoading}
      error={leasesQuery.error}
      lease={leasesQuery.data?.[0]}
    />
  )
}
