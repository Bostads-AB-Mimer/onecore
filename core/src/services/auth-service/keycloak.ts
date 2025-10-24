import keycloak from 'keycloak-koa'
import config from '../../common/config'
import { logger } from '@onecore/utilities'
import axios from 'axios'
import * as jose from 'jose'
import type { TokenData } from 'keycloak-koa/dist/types'

// Initialize Keycloak with configuration
const auth = keycloak({
  keycloakUrl: `${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}`,
  clientId: config.auth.keycloak.clientId,
  clientSecret: config.auth.keycloak.clientSecret,
})

// Log Keycloak configuration on startup
logger.info(
  `Keycloak initialized with URL: ${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}`
)

// In-memory lock to prevent concurrent refresh attempts (race condition protection)
let refreshInProgress: Promise<TokenData> | null = null

/**
 * Check if an access token is expiring soon
 * @param token - JWT access token
 * @param bufferSeconds - Number of seconds before expiry to consider "expiring soon"
 * @returns true if token expires within bufferSeconds
 */
const isTokenExpiringSoon = (token: string, bufferSeconds = 60): boolean => {
  try {
    const decoded = jose.decodeJwt(token)
    const exp = decoded.exp

    if (!exp) {
      logger.warn('Token has no expiry claim')
      return true
    }

    const now = Date.now()
    const expiresAtMs = exp * 1000
    const expiresInMs = expiresAtMs - now
    const bufferMs = bufferSeconds * 1000

    const isExpiring = expiresInMs < bufferMs

    return isExpiring
  } catch (error) {
    logger.error(error, 'Error decoding token for expiry check')
    return true // If we can't decode, assume expired
  }
}

/**
 * Refresh access token using refresh_token with race condition protection
 * @param refreshToken - Refresh token from cookie
 * @returns New token data with fresh access_token and refresh_token
 */
const refreshAccessToken = async (refreshToken: string): Promise<TokenData> => {
  // If refresh already in progress, wait for it (prevents race conditions)
  if (refreshInProgress) {
    logger.info('Refresh already in progress, waiting for completion...')
    return refreshInProgress
  }

  // Start refresh and store promise to prevent concurrent refreshes
  refreshInProgress = (async () => {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: auth.clientId,
        client_secret: config.auth.keycloak.clientSecret || '',
        refresh_token: refreshToken,
      }).toString()

      const tokenEndpoint = `${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}/protocol/openid-connect/token`

      const response = await axios.post<TokenData>(tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000, // 10 second timeout to prevent indefinite hangs
      })

      return response.data
    } catch (error) {
      logger.error(error, 'Token refresh failed')
      throw error
    }
  })()

  try {
    const result = await refreshInProgress
    return result
  } finally {
    // Clear lock after completion (success or failure)
    refreshInProgress = null
  }
}

// Export enhanced auth instance with new methods
export default {
  ...auth,
  isTokenExpiringSoon,
  refreshAccessToken,
}
