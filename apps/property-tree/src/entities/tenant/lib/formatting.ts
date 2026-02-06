import type { Tenant } from '@/services/types'

export function formatTenantAddress(address: NonNullable<Tenant['address']>) {
  const street = address.street
    ? `${address.street} ${address.number}`
    : address.number
  return `${street}, ${address.postalCode} ${address.city}`
}

export function formatTenantName(
  tenant: Pick<Tenant, 'firstName' | 'lastName' | 'fullName'>
) {
  return tenant.firstName && tenant.lastName
    ? `${tenant.firstName} ${tenant.lastName}`
    : tenant.fullName || '-'
}
