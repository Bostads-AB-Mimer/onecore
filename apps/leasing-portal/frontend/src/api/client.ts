import createClient, { type Middleware } from 'openapi-fetch'

import { BffNotConfiguredError } from './errors'
import type { paths } from './generated/api-types'

export type LeasingApi = ReturnType<typeof createClient<paths>>

export interface LeasingApiConfig {
  /** BFF base URL including its /leasing-portal prefix. */
  bffUrl: string
  /** Core base URL, used for the token refresh on 401. */
  coreUrl: string
}

/**
 * The BFF forwards our token as a bearer, so core never refreshes it on the
 * way through. On a 401 we refresh via core's cookie route and retry once.
 * Parallel 401s share one refresh: Keycloak rotates refresh tokens, so a
 * second refresh would fail. The retry is a plain fetch and cannot loop.
 */
export const refreshOnUnauthorized = (coreUrl: string): Middleware => {
  const originals = new Map<string, Request>()
  let refreshing: Promise<boolean> | null = null

  const refreshSession = () => {
    refreshing ??= fetch(`${coreUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  return {
    onRequest({ id, request }) {
      originals.set(id, request.clone())
    },
    onError({ id }) {
      originals.delete(id)
    },
    async onResponse({ id, response }) {
      const original = originals.get(id)
      originals.delete(id)
      if (response.status !== 401 || !original) return undefined

      return (await refreshSession()) ? fetch(original) : undefined
    },
  }
}

/** Spec paths are prefix-free; `bffUrl` carries the /leasing-portal prefix. */
export const createLeasingApi = ({
  bffUrl,
  coreUrl,
}: LeasingApiConfig): LeasingApi => {
  // Without a BFF url every call fails explicitly instead of hitting the
  // host's own origin; the placeholder keeps Request construction valid.
  const configured = bffUrl !== ''
  const api = createClient<paths>({
    baseUrl: configured ? bffUrl : 'http://bff.not-configured.invalid',
    credentials: 'include',
    fetch: configured
      ? undefined
      : () => Promise.reject(new BffNotConfiguredError()),
  })
  api.use(refreshOnUnauthorized(coreUrl))
  return api
}
