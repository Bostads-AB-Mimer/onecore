import { Context, Next } from 'koa'
import axios from 'axios'
import auth from '../services/auth-service/keycloak'
import config from '../common/config'
import { logger } from '@onecore/utilities'

/**
 * Exchange Basic Auth credentials with Keycloak using client_credentials grant.
 * Takes the raw base64-encoded credentials from the Basic header.
 * Returns the access_token JWT string, or undefined on failure.
 */
async function exchangeBasicForToken(
  ctx: Context,
  base64Credentials: string
): Promise<string | undefined> {
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

// --- Token extraction middlewares ---
// Each one tries to set ctx.state.accessToken from its source,
// then delegates to the next extractor if it didn't find anything.

async function extractCookieToken(ctx: Context, next: Next) {
  let token = ctx.cookies.get('auth_token')
  if (!token) return next()

  // Proactive token refresh
  const refreshToken = ctx.cookies.get('refresh_token')
  if (refreshToken && auth.isTokenExpiringSoon(token, 60)) {
    try {
      const newTokens = await auth.refreshAccessToken(refreshToken)
      auth.tokenService.setCookies(ctx, newTokens)
      token = newTokens.access_token
    } catch (refreshError) {
      logger.error(
        refreshError,
        'Token refresh failed, falling back to existing token'
      )
    }
  }

  ctx.state.accessToken = token
  await next()
}

async function extractBasicAuthToken(ctx: Context, next: Next) {
  if (ctx.state.accessToken) return next()

  const authHeader = ctx.get('Authorization')
  if (!authHeader?.startsWith('Basic ')) return next()

  const token = await exchangeBasicForToken(
    ctx,
    authHeader.slice('Basic '.length)
  )
  if (token) {
    ctx.state.accessToken = token
  }
  await next()
}

async function extractBearerToken(ctx: Context, next: Next) {
  if (ctx.state.accessToken) return next()

  const authHeader = ctx.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    ctx.state.accessToken = authHeader.slice('Bearer '.length)
  }
  await next()
}

/**
 * Middleware that tries to extract a token from multiple sources (in order):
 *   1. Cookie (auth_token)
 *   2. Basic Auth (exchanged for Keycloak token)
 *   3. Bearer header
 *
 * Sets ctx.state.accessToken from the first matching source.
 * Token verification (Keycloak JWKS / legacy JWT) happens in requireAuth.
 */
export const extractToken = async (ctx: Context, next: Next) => {
  if (ctx.path.startsWith('/scan-receipt')) {
    const authHeader = ctx.get('Authorization')
    logger.info(
      {
        hasAuthHeader: !!authHeader,
        authType: authHeader?.split(' ')[0] || 'none',
        path: ctx.path,
      },
      'Scan receipt auth debug'
    )
  }

  await extractCookieToken(ctx, async () => {
    await extractBasicAuthToken(ctx, async () => {
      await extractBearerToken(ctx, next)
    })
  })
}
