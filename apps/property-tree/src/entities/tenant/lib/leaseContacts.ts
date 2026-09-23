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
