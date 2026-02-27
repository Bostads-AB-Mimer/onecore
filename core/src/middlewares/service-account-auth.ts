import { Context, Next } from 'koa'
import axios from 'axios'
import * as jose from 'jose'
import config from '../common/config'
import { logger } from '@onecore/utilities'

/**
 * Route prefixes accessible via service account (Basic Auth → Keycloak).
 * These routes bypass the global JWT middleware and body parser in app.ts.
 */
const serviceAccountRoutes: string[] = ['/scan-receipt']

const jwks = jose.createRemoteJWKSet(
  new URL(
    `${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}/protocol/openid-connect/certs`
  )
)

export const isServiceAccountRoute = (path: string): boolean =>
  serviceAccountRoutes.some((prefix) => path.startsWith(prefix))

/**
 * Middleware that authenticates via Basic Auth → Keycloak client_credentials grant.
 *
 * The caller sends `Authorization: Basic <base64(client_id:client_secret)>`.
 * This middleware exchanges those credentials with Keycloak's token endpoint
 * using the client_credentials grant type. If Keycloak accepts the credentials,
 * the returned access token is decoded and (optionally) checked for a required role.
 */
export const requireServiceAccountAuth = (requiredRole?: string) => {
  return async (ctx: Context, next: Next) => {
    try {
      const authHeader = ctx.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Basic ')) {
        ctx.status = 401
        ctx.set('WWW-Authenticate', 'Basic realm="onecore"')
        ctx.body = { message: 'Authentication required' }
        return
      }

      const base64Credentials = authHeader.slice('Basic '.length)
      const credentialsString = Buffer.from(
        base64Credentials,
        'base64'
      ).toString('utf-8')
      const separatorIndex = credentialsString.indexOf(':')

      if (separatorIndex === -1) {
        ctx.status = 401
        ctx.body = { message: 'Invalid Basic Auth format' }
        return
      }

      const clientId = credentialsString.slice(0, separatorIndex)
      const clientSecret = credentialsString.slice(separatorIndex + 1)

      if (!clientId || !clientSecret) {
        ctx.status = 401
        ctx.body = { message: 'Missing client credentials' }
        return
      }

      const tokenEndpoint = `${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}/protocol/openid-connect/token`

      let accessToken: string
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

        accessToken = response.data.access_token
      } catch (err) {
        logger.error(
          { err, clientId },
          'Service account authentication failed — Keycloak rejected credentials'
        )
        ctx.status = 401
        ctx.body = { message: 'Invalid credentials' }
        return
      }

      if (!accessToken) {
        logger.error('Keycloak returned success but no access_token')
        ctx.status = 401
        ctx.body = { message: 'Invalid credentials' }
        return
      }

      const { payload } = await jose.jwtVerify(accessToken, jwks)

      if (requiredRole) {
        const realmAccess = payload.realm_access as
          | { roles?: string[] }
          | undefined
        const roles = realmAccess?.roles || []

        if (!roles.includes(requiredRole)) {
          logger.warn(
            { clientId, requiredRole, roles },
            'Service account missing required role'
          )
          ctx.status = 403
          ctx.body = { message: 'Insufficient permissions' }
          return
        }
      }

      ctx.state.user = {
        id: payload.sub,
        preferred_username: payload.preferred_username,
        source: 'service-account',
        realm_access: payload.realm_access,
      }

      return next()
    } catch (err) {
      logger.error(err, 'Unexpected error in service account auth middleware')
      ctx.status = 401
      ctx.body = { message: 'Authentication failed' }
    }
  }
}
