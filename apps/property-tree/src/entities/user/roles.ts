import type { User } from './types'

export const INVOICE_DEFERRAL_ROLE = 'invoice-deferral'

export function hasAnyRole(user: User, roles: string[]) {
  const userRoles = user.roles
  return roles.some((role) => userRoles.includes(role))
}
