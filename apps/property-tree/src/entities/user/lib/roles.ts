import type { User } from '../types'

/** Keycloak realm role that allows creating, editing and deleting guides. */
export const GUIDES_ADMIN_ROLE = 'guides-admin'

export const hasRole = (user: User | null | undefined, role: string) =>
  user?.realm_access?.roles?.includes(role) ?? false
