import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeycloakUserSchema } from '@onecore/types'

import { useAuthConfig } from './context'
import { login, logout, takePendingLogin } from './login'
import { safeReturnTo } from './returnTo'

export function useAuth() {
  const config = useAuthConfig()

  return useMemo(
    () => ({
      login: (returnTo?: string) => login(config, returnTo),
      logout: () => logout(config),
    }),
    [config]
  )
}

/** The logged-in user. Structurally a `ModuleUser` from `@onecore/ui`, plus `employeeId`. */
export interface AuthUser {
  id: string
  name?: string
  email?: string
  /** Xpand signature (e.g. "YY2333"), present once the realm maps employeeId. */
  employeeId?: string
  roles: string[]
}

/**
 * - `unauthenticated`: core answered 401; send the user to login.
 * - `unavailable`: core is down or unreachable (5xx, network error). Logging in
 *   again would not help.
 * - `unknown`: anything else, such as a profile that doesn't match the schema.
 */
export type UserError = 'unauthenticated' | 'unavailable' | 'unknown'

export type UserState =
  | { tag: 'loading' }
  | { tag: 'error'; error: UserError }
  | { tag: 'success'; user: AuthUser }

const toAuthUser = (profile: unknown): AuthUser => {
  const parsed = KeycloakUserSchema.safeParse(profile)
  if (!parsed.success) throw 'unknown' satisfies UserError

  const { id, name, email, employeeId, realm_access } = parsed.data
  return { id, name, email, employeeId, roles: realm_access?.roles ?? [] }
}

/**
 * Polls core's profile route, which also keeps the session cookie fresh.
 *
 * Once a user has loaded, only a 401 replaces it with an error: a failed poll
 * because core is briefly down keeps the user on the page instead of sending
 * them away from unsaved work.
 */
export function useUser(): UserState {
  const { coreUrl } = useAuthConfig()

  const q = useQuery<AuthUser, UserError>({
    queryKey: ['onecore-auth', 'user', coreUrl],
    retry: (failureCount, error) =>
      error === 'unauthenticated' ? false : failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    refetchInterval: 5000,
    queryFn: async () => {
      let res: Response
      try {
        res = await fetch(`${coreUrl}/auth/profile`, { credentials: 'include' })
      } catch {
        throw 'unavailable' satisfies UserError
      }

      if (res.status === 401) throw 'unauthenticated' satisfies UserError
      if (res.status >= 500) throw 'unavailable' satisfies UserError
      if (!res.ok) throw 'unknown' satisfies UserError

      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw 'unknown' satisfies UserError
      }
      return toAuthUser(body)
    },
  })

  if (q.data && q.error !== 'unauthenticated') {
    return { tag: 'success', user: q.data }
  }
  if (q.isError) return { tag: 'error', error: q.error }
  return { tag: 'loading' }
}

/** `useUser`, plus a single redirect to login when the user is unauthenticated. */
export function useRequireUser(): UserState {
  const user = useUser()
  const { login } = useAuth()
  // login() navigates away; fire it once even though the effect re-runs.
  const redirecting = useRef(false)

  const unauthenticated =
    user.tag === 'error' && user.error === 'unauthenticated'

  useEffect(() => {
    if (unauthenticated && !redirecting.current) {
      redirecting.current = true
      login()
    }
  }, [unauthenticated, login])

  return user
}

/**
 * - `missing-code`: Keycloak sent the user back without a code.
 * - `state-mismatch`: no pending login in this tab, or a different nonce. The
 *   code is not exchanged, so a login can't be completed by someone else's link.
 * - `exchange-failed`: core refused the code or could not be reached.
 */
export type CallbackError =
  'missing-code' | 'state-mismatch' | 'exchange-failed'

export type CallbackState =
  | { tag: 'loading' }
  | { tag: 'success'; returnTo: string }
  | { tag: 'error'; error: CallbackError }

/** Completes a login on the app's callback route. Navigating to `returnTo` is up to the app. */
export function useAuthCallback(): CallbackState {
  const { coreUrl, redirectUri } = useAuthConfig()
  const [state, setState] = useState<CallbackState>({ tag: 'loading' })
  // Guards against the double effect run under <StrictMode/> in development.
  const requested = useRef(false)

  const complete = useCallback(async (): Promise<CallbackState> => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const nonce = params.get('state')
    const pending = takePendingLogin()

    if (!code) return { tag: 'error', error: 'missing-code' }
    if (!pending || !nonce || pending.nonce !== nonce) {
      return { tag: 'error', error: 'state-mismatch' }
    }

    try {
      const res = await fetch(`${coreUrl}/auth/callback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri }),
      })
      if (!res.ok) return { tag: 'error', error: 'exchange-failed' }
    } catch {
      return { tag: 'error', error: 'exchange-failed' }
    }

    return { tag: 'success', returnTo: safeReturnTo(pending.returnTo) }
  }, [coreUrl, redirectUri])

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    void complete().then(setState)
  }, [complete])

  return state
}
