import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'

import { authConfig } from '@/authConfig'

import { User } from '../types'

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
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // 1s, 2s, 3s max
    refetchInterval: 5000,
    queryFn: async () => {
      try {
        const res = await fetch(`${authConfig.apiUrl}/auth/profile`, {
          credentials: 'include',
        })

        if (!res.ok) {
          // 401 = Not authenticated → redirect to login
          if (res.status === 401) {
            throw 'unauthenticated'
          }

          // 502, 503, 504 = Backend/Keycloak unavailable → treat as auth issue
          // This commonly happens in dev environment when Keycloak is slow
          if (res.status >= 502 && res.status <= 504) {
            throw 'unauthenticated' // Redirect to login, don't show error
          }

          // 500 = Server error → also treat as auth issue (safer than showing error)
          if (res.status === 500) {
            throw 'unauthenticated'
          }

          // Only other errors (403, 400, etc.) show "Okänt fel"
          throw 'unknown'
        }

        return res.json()
      } catch (error) {
        // Network errors (DNS failure, connection refused, timeout)
        // This happens when backend is down or unreachable
        if (error instanceof TypeError) {
          throw 'unauthenticated' // Redirect to login, don't show error
        }

        // Re-throw if it's already our error type
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
