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

export function hasAnyRole(user: User, roles: string[]) {
  // A token without any role claim means "no roles", never a crash.
  const userRoles = user.roles ?? []
  return roles.some((role) => userRoles.includes(role))
}
