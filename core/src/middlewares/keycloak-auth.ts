import { Context, Next } from 'koa'
import axios from 'axios'
import auth from '../services/auth-service/keycloak'
import config from '../common/config'
import { logger } from '@onecore/utilities'

/**
 * Exchange Basic Auth credentials with Keycloak using client_credentials grant.
 * Returns the access_token JWT string, or null if the exchange fails
 * (in which case ctx.status and ctx.body are already set).
 */
async function exchangeBasicForToken(
  ctx: Context,
  authHeader: string
): Promise<string | undefined> {
  const base64Credentials = authHeader.slice('Basic '.length)
  const credentialsString = Buffer.from(base64Credentials, 'base64').toString(
    'utf-8'
  )
  const separatorIndex = credentialsString.indexOf(':')

  if (separatorIndex === -1) {
    ctx.status = 401
    ctx.set('WWW-Authenticate', `Basic realm="${config.auth.keycloak.realm}"`)
    ctx.body = { message: 'Invalid Basic Auth format' }
    return undefined
  }

  const clientId = credentialsString.slice(0, separatorIndex)
  const clientSecret = credentialsString.slice(separatorIndex + 1)

  if (!clientId || !clientSecret) {
    ctx.status = 401
    ctx.set('WWW-Authenticate', `Basic realm="${config.auth.keycloak.realm}"`)
    ctx.body = { message: 'Missing client credentials' }
    return undefined
  }

  const tokenEndpoint = `${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}/protocol/openid-connect/token`

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString()

    const response = await axios.post(tokenEndpoint, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    })

    const accessToken = response.data.access_token
    if (!accessToken) {
      logger.error('Keycloak returned success but no access_token')
      ctx.status = 401
      ctx.body = { message: 'Invalid credentials' }
      return undefined
    }

    return accessToken
  } catch (err) {
    logger.error(
      { err, clientId },
      'Service account authentication failed — Keycloak rejected credentials'
    )
    ctx.status = 401
    ctx.set('WWW-Authenticate', `Basic realm="${config.auth.keycloak.realm}"`)
    ctx.body = { message: 'Invalid credentials' }
    return undefined
  }
}

// Middleware to protect routes with proactive token refresh and Basic Auth support
export const requireAuth = async (ctx: Context, next: Next) => {
  try {
    let accessToken = ctx.cookies.get('auth_token')
    const isCookieAuth = !!accessToken

    // If no cookie, try Basic Auth header
    if (!accessToken) {
      const authHeader = ctx.get('Authorization')
      if (authHeader?.startsWith('Basic ')) {
        accessToken = await exchangeBasicForToken(ctx, authHeader)
        if (!accessToken) return
      }
    }

    if (!accessToken) {
      ctx.status = 401
      ctx.body = { message: 'Authentication required' }
      return
    }

    // Proactive token refresh (cookie path only)
    if (isCookieAuth) {
      const refreshToken = ctx.cookies.get('refresh_token')
      if (auth.isTokenExpiringSoon(accessToken, 60) && refreshToken) {
        try {
          const newTokens = await auth.refreshAccessToken(refreshToken)
          auth.tokenService.setCookies(ctx, newTokens)
          accessToken = newTokens.access_token
        } catch (refreshError) {
          logger.error(
            refreshError,
            'Token refresh failed, falling back to existing token'
          )
        }
      }
    }

    // Single verification path for all token sources
    const verifiedToken = await auth.jwksService.verifyToken(accessToken)

    ctx.state.user = {
      id: verifiedToken.sub,
      email: verifiedToken.email,
      name: verifiedToken.name,
      preferred_username: verifiedToken.preferred_username,
      source: isCookieAuth ? 'keycloak' : 'service-account',
      realm_access: verifiedToken.realm_access,
    }

    return next()
  } catch (error) {
    logger.error(error, 'Authentication error:')
    ctx.status = 401
    ctx.body = { message: 'Authentication required' }
  }
}

// Middleware to check for specific Keycloak realm roles.
// Must run after requireAuth (ctx.state.user must already be set).
export const requireRole = (requiredRoles: string | string[]) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]

  return async (ctx: Context, next: Next) => {
    try {
      const userRoles: string[] = ctx.state.user?.realm_access?.roles || []
      const hasRequiredRole = roles.some((role) => userRoles.includes(role))

      if (!hasRequiredRole) {
        ctx.status = 403
        ctx.body = { message: 'Insufficient permissions' }
        return
      }

      return next()
    } catch (error) {
      logger.error(error, 'Role verification error:')
      ctx.status = 403
      ctx.body = { message: 'Insufficient permissions' }
    }
  }
}
