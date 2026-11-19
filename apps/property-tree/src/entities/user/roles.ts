import type { User } from './types'

export const INVOICE_DEFERRAL_ROLE = 'invoice-deferral'

/**
 * Permission to write contact data: creating a customer, and adding or
 * removing a relation on one.
 *
 * Gated separately from reading because creating a contact writes to Xpand and
 * ONECore cannot remove it again.
 */
export const CONTACTS_WRITE_ROLE = 'contacts:write'

/** Permission to list and export home insurances, with the tenants' personal data. */
export const HOME_INSURANCE_READ_ROLE = 'home-insurance:read'

/** Permission to end a home insurance row or change its T.o.m. */
export const HOME_INSURANCE_WRITE_ROLE = 'home-insurance:write'

/** Permission to see the restlista: tenants' names next to what they owe. */
export const OPEN_INVOICES_READ_ROLE = 'open-invoices:read'

export function hasAnyRole(user: User, roles: string[]) {
  // A token without any role claim means "no roles", never a crash.
  const userRoles = user.roles ?? []
  return roles.some((role) => userRoles.includes(role))
}
