import { useQuery } from '@tanstack/react-query'
import { KeycloakUserSchema } from '@onecore/types'

import type { LeasingUser } from '../../host/types'
import { authConfig } from '../authConfig'

type UserError = 'unauthenticated' | 'unknown'

export type UserState =
  | { tag: 'loading' }
  | { tag: 'error'; error: UserError }
  | { tag: 'success'; user: LeasingUser }

/** Core's profile is the Keycloak user shape shared through @onecore/types. */
const toLeasingUser = (profile: unknown): LeasingUser => {
  const parsed = KeycloakUserSchema.safeParse(profile)
  if (!parsed.success) throw 'unknown'

  const { id, name, email, realm_access } = parsed.data
  return { id, name, email, roles: realm_access?.roles ?? [] }
}

export function useUser(): UserState {
  const q = useQuery<LeasingUser, UserError>({
    queryKey: ['auth', 'user'],
    retry: (failureCount, error) =>
      error === 'unauthenticated' ? false : failureCount < 2,
    refetchInterval: 5000,
    queryFn: async () => {
      let res: Response
      try {
        res = await fetch(`${authConfig.apiUrl}/auth/profile`, {
          credentials: 'include',
        })
      } catch {
        throw 'unauthenticated'
      }

      // 5xx usually means core or Keycloak is unavailable; send to login rather than show an error.
      if (res.status === 401 || res.status >= 500) throw 'unauthenticated'
      if (!res.ok) throw 'unknown'

      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw 'unknown'
      }
      return toLeasingUser(body)
    },
  })

  if (q.isPending) return { tag: 'loading' }
  if (q.isError) return { tag: 'error', error: q.error }
  return { tag: 'success', user: q.data }
}
