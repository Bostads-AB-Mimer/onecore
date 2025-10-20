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
    retry: false,
    refetchInterval: 5000,
    queryFn: () =>
      fetch(`${authConfig.apiUrl}/auth/profile`, {
        credentials: 'include',
      }).then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw 'unauthenticated'
          } else {
            throw 'unknown'
          }
        }

        return res.json()
      }),
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
