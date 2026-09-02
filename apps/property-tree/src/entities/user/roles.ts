import type { User } from './types'

export const INVOICE_DEFERRAL_ROLE = 'invoice-deferral'

/**
 * Permission to create customers.
 *
 * Gated separately from reading because creating a contact writes to Xpand and
 * cannot be undone — there is no delete operation.
 */
export const CONTACT_CREATE_ROLE = 'contacts:write'

export function hasAnyRole(user: User, roles: string[]) {
  // A token without any role claim means "no roles", never a crash.
  const userRoles = user.roles ?? []
  return roles.some((role) => userRoles.includes(role))
}
