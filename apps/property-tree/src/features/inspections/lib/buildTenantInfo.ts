// Imported from the lib file, not the entity barrel, which pulls in the API client
import { isSubletTenant } from '@/entities/tenant/lib/leaseContacts'

import type { Lease } from '@/services/api/core/leaseService'

import type { TenantInfoCardData } from '../types'

// A preliminary termination is not yet confirmed (it can still be awaiting
// signing), so the card labels it differently from a confirmed one.
const getTermination = (
  status: Lease['status']
): TenantInfoCardData['termination'] => {
  if (status === 'AboutToEnd') return 'confirmed'
  if (status === 'PreliminaryTerminated') return 'preliminary'
  return undefined
}

export const buildTenantInfo = (
  lease: Lease | undefined
): TenantInfoCardData | undefined => {
  const tenant = lease?.tenants?.find((t) => !isSubletTenant(t))
  if (!lease || !tenant) return undefined

  return {
    contactCode: tenant.contactCode,
    fullName: tenant.fullName ?? '',
    moveInDate: lease.leaseStartDate,
    moveOutDate:
      lease.terminationDate ?? lease.preferredMoveOutDate ?? lease.leaseEndDate,
    termination: getTermination(lease.status),
  }
}
