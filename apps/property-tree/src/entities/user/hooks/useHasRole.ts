import { hasRole } from '../lib/roles'
import { useUser } from './useUser'

/** True when the signed-in user carries the given Keycloak realm role. */
export function useHasRole(role: string): boolean {
  const userState = useUser()
  return userState.tag === 'success' && hasRole(userState.user, role)
}
