import { useQuery } from '@tanstack/react-query'

import { type Lease, leaseService } from '@/services/api/core/leaseService'

import type { TenantInfoCardData } from '../types'

const buildTenantInfo = (
  lease: Lease | undefined
): TenantInfoCardData | undefined => {
  const tenant = lease?.tenants?.find(
    (t) => t.leaseContactType?.trim() === 'INNEHAVARE'
  )
  if (!lease || !tenant) return undefined

  return {
    contactCode: tenant.contactCode,
    fullName: tenant.fullName,
    moveInDate: lease.leaseStartDate,
    moveOutDate:
      lease.terminationDate ?? lease.preferredMoveOutDate ?? lease.leaseEndDate,
    isAboutToLeave: lease.status === 'AboutToEnd',
  }
}

export function useTenantInfo(
  residenceId: string | undefined,
  leaseId: string | undefined
) {
  const { data: leases } = useQuery<Lease[]>({
    queryKey: ['leases-by-rental-property', residenceId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(residenceId!, {
        includeContacts: true,
        includeUpcomingLeases: true,
        includeTerminatedLeases: true,
      }),
    enabled: !!residenceId,
  })

  const matchingLease = leases?.find((l) => l.leaseId === leaseId)

  return buildTenantInfo(matchingLease)
}
