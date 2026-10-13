import type { AuthConfig } from './context'
import { safeReturnTo } from './returnTo'

const PENDING_LOGIN_KEY = 'onecore-auth:pending-login'

/** What a login started in this tab expects to find when Keycloak sends the user back. */
export interface PendingLogin {
  /** Sent to Keycloak as `state`; the callback must receive the same value. */
  nonce: string
  returnTo: string
}

export function buildLoginUrl(config: AuthConfig, nonce: string): string {
  const baseUrl = config.keycloakUrl.replace(/\/realms\/[a-zA-Z0-9-]+\/?$/, '')
  const url = new URL(
    `${baseUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/auth`
  )
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', nonce)
  return url.toString()
}

/**
 * Records a pending login and returns the Keycloak URL to send the user to.
 *
 * `state` carries only a random nonce, kept with the return path in
 * sessionStorage, so a callback can only complete a login this tab started.
 */
export function prepareLogin(config: AuthConfig, returnTo: string): string {
  const pending: PendingLogin = {
    nonce: crypto.randomUUID(),
    returnTo: safeReturnTo(returnTo),
  }
  sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify(pending))
  return buildLoginUrl(config, pending.nonce)
}

/** Reads and clears the pending login, so a nonce can only be used once. */
export function takePendingLogin(): PendingLogin | null {
  const raw = sessionStorage.getItem(PENDING_LOGIN_KEY)
  sessionStorage.removeItem(PENDING_LOGIN_KEY)
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'nonce' in parsed &&
      'returnTo' in parsed &&
      typeof parsed.nonce === 'string' &&
      typeof parsed.returnTo === 'string'
    ) {
      return { nonce: parsed.nonce, returnTo: parsed.returnTo }
    }
  } catch {
    // Unparseable: treated as no pending login.
  }
  return null
}

export function login(
  config: AuthConfig,
  returnTo = `${window.location.pathname}${window.location.search}`
) {
  window.location.assign(prepareLogin(config, returnTo))
}

export function logout(config: AuthConfig) {
  window.location.assign(`${config.coreUrl}/auth/logout`)
}
