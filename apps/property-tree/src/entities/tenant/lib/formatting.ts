import type { Tenant } from '@/services/types'

export function formatTenantAddress(address: NonNullable<Tenant['address']>) {
  const street = address.street
    ? `${address.street} ${address.number}`
    : address.number
  return `${street}, ${address.postalCode} ${address.city}`
}

export function formatTenantName(tenant: {
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  protectedIdentity?: boolean
}) {
  if (tenant.protectedIdentity) {
    return 'Skyddad identitet'
  }
  return tenant.firstName && tenant.lastName
    ? `${tenant.firstName} ${tenant.lastName}`
    : tenant.fullName || '-'
}
