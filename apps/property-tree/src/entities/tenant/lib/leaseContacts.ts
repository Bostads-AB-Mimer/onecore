const SUBLET_TENANT = 'subletTenant'

type LeaseContact = { leaseContactType?: string }

export function isSubletTenant(tenant: LeaseContact) {
  return tenant.leaseContactType === SUBLET_TENANT
}

export function getLeaseContactTitle(tenant: LeaseContact) {
  return isSubletTenant(tenant) ? 'Andrahandshyresgäst' : 'Kontraktsinnehavare'
}

export function sortLeaseContacts<T extends LeaseContact>(tenants: T[]) {
  return [...tenants].sort(
    (a, b) => Number(isSubletTenant(a)) - Number(isSubletTenant(b))
  )
}

type SubletLease = { subletContactId?: string }

export function hasSubletTenant(lease: SubletLease) {
  return !!lease.subletContactId
}

export function isSubletTenantOnLeases(
  leases: SubletLease[],
  contactCode: string
) {
  return leases.some((lease) => lease.subletContactId === contactCode)
}
