import { useQuery } from '@tanstack/react-query'

import { type Lease, leaseService } from '@/services/api/core/leaseService'

import { buildTenantInfo } from '../lib/buildTenantInfo'

export function useTenantInfo(
  residenceId: string | undefined,
  leaseId: string | undefined
) {
  const { data: leases } = useQuery<Lease[]>({
    queryKey: ['leases-by-rental-property', residenceId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(residenceId!, {
        includeContacts: true,
      }),
    enabled: !!residenceId,
  })

  const matchingLease = leases?.find((l) => l.leaseId === leaseId)

  return buildTenantInfo(matchingLease)
}
