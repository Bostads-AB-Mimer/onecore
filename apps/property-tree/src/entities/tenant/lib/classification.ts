import type { Tenant } from '@/services/types'

export function isOrganization(tenant: Pick<Tenant, 'contactCode'>) {
  return tenant.contactCode.startsWith('F')
}

export function getTenantRoles(
  tenant: Pick<Tenant, 'isTenant'> &
    Partial<Pick<Tenant, 'parkingSpaceWaitingList'>>
) {
  const roles: string[] = []
  if (tenant.isTenant) roles.push('Hyresgäst')
  if (tenant.parkingSpaceWaitingList) roles.push('Sökande')
  return roles.length > 0 ? roles.join(', ') : '-'
}
