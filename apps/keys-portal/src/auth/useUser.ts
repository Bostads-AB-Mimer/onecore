import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'

import { authConfig } from '@/auth-config'

export type User = {
  id: string
  name: string
  email: string
  roles: string[]
}

type UserState =
  | { tag: 'loading' }
  | { tag: 'error'; error: 'unauthenticated' | 'unknown' }
  | { tag: 'success'; user: User }

export function useUser() {
  const q = useQuery<User, 'unauthenticated' | 'unknown'>({
    queryKey: ['auth', 'user'],
    retry: (failureCount, error) => {
      // Don't retry unauthenticated errors (would create redirect loop)
      if (error === 'unauthenticated') return false

      // Retry unknown errors up to 2 times (helps with transient Keycloak issues)
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    refetchInterval: 5000,
    queryFn: async () => {
      try {
        const res = await fetch(`${authConfig.apiUrl}/auth/profile`, {
          credentials: 'include',
        })

        if (!res.ok) {
          if (res.status === 401) {
            throw 'unauthenticated'
          }

          // 500, 502-504 = Backend/Keycloak unavailable → redirect to login
          if (res.status === 500 || (res.status >= 502 && res.status <= 504)) {
            throw 'unauthenticated'
          }

          throw 'unknown'
        }

        return res.json()
      } catch (error) {
        // Network errors (DNS failure, connection refused, timeout)
        if (error instanceof TypeError) {
          throw 'unauthenticated'
        }

        throw error
      }
    },
  })

  return match(q)
    .returnType<UserState>()
    .with({ isLoading: true }, () => ({ tag: 'loading' }))
    .with(
      { data: P.not(P.nullish), isLoading: false, isError: false },
      (v) => ({
        tag: 'success',
        user: v.data,
      })
    )
    .with({ error: 'unauthenticated', isLoading: false }, () => ({
      tag: 'error',
      error: 'unauthenticated',
    }))
    .with({ error: 'unknown', isLoading: false }, () => ({
      tag: 'error',
      error: 'unknown',
    }))
    .otherwise(() => ({ tag: 'loading' }))
}
