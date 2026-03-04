import axios, { AxiosError } from 'axios'
import { loggedAxios, logger } from '@onecore/utilities'
import config from '../../common/config'
import { AdapterResult } from '../../adapters/types'

type GetUsersByRoleError =
  | 'keycloak_unreachable'
  | 'unauthorized'
  | 'role_not_found'
  | 'unknown'

// client_credentials grant does not issue a refresh token — the client authenticates
// directly with its own credentials, so re-requesting a new token is the only option.
let cachedToken: { value: string; expiresAt: number } | null = null
// Holds the in-flight token request so concurrent callers share one request instead of
// each firing their own, preventing a thundering herd when the token expires.
let tokenPromise: Promise<string> | null = null

async function fetchNewToken(): Promise<string> {
  const { url, realm, clientId, clientSecret } = config.auth.keycloak
  const res = await axios.post(
    `${url}/realms/${realm}/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  cachedToken = {
    value: res.data.access_token,
    // expires_in is in seconds; subtract 30 s in getAdminToken to renew before expiry
    expiresAt: Date.now() + res.data.expires_in * 1000,
  }
  return cachedToken.value
}

async function getAdminToken(): Promise<string> {
  // Serve from cache if the token is still valid with 30 s to spare
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value
  }
  // Deduplicate concurrent refresh attempts — only one HTTP call goes out
  if (!tokenPromise) {
    tokenPromise = fetchNewToken().finally(() => (tokenPromise = null))
  }
  return tokenPromise
}

async function fetchUsersByRole(roleName: string, token: string) {
  const { url, realm } = config.auth.keycloak
  return loggedAxios.get(
    `${url}/admin/realms/${realm}/roles/${encodeURIComponent(roleName)}/users`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
}

export async function getUsersByRole(
  roleName: string
): Promise<AdapterResult<unknown[], GetUsersByRoleError>> {
  try {
    const token = await getAdminToken()
    try {
      const res = await fetchUsersByRole(roleName, token)
      return { ok: true, data: res.data }
    } catch (error) {
      // Token may have been revoked — clear cache and retry once with a fresh token
      if (error instanceof AxiosError && error.response?.status === 401) {
        cachedToken = null
        const freshToken = await getAdminToken()
        const res = await fetchUsersByRole(roleName, freshToken)
        return { ok: true, data: res.data }
      }
      throw error
    }
  } catch (error) {
    logger.error(error, 'keycloak-admin-adapter.getUsersByRole')
    if (error instanceof AxiosError) {
      if (!error.response) return { ok: false, err: 'keycloak_unreachable' }
      if (error.response.status === 401)
        return { ok: false, err: 'unauthorized' }
      if (error.response.status === 404)
        return { ok: false, err: 'role_not_found' }
    }
    return { ok: false, err: 'unknown' }
  }
}
