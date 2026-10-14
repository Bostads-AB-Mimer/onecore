import KoaRouter from '@koa/router'

import {
  exchangeContactsAuthorizationCode,
  isContactsKeycloakConfigured,
  refreshContactsAccessToken,
} from './keycloak-contacts'
import {
  bodyForContactsKeycloakError,
  httpStatusForContactsKeycloakError,
  logContactsKeycloakTokenError,
} from './contacts-keycloak-errors'
import {
  contactsTokenToJson,
  readCodeVerifierFromBody,
  readJsonBodyRecord,
  readRefreshTokenFromBody,
} from './contacts-auth-dto'

/**
 * OAuth helper routes for mimer.nu (mimer-contacts realm).
 * Returns token JSON for webapi — does not set browser cookies on core.
 */
export const registerContactsAuthRoutes = (router: KoaRouter) => {
  /**
   * @swagger
   * /auth/contacts/token:
   *   post:
   *     summary: Exchange authorization code for mimer-contacts tokens
   *     description: Server-to-server helper for webapi. Exchanges a Keycloak authorization code using the mina-sidor confidential client.
   *     tags:
   *       - Auth
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - code
   *               - redirectUri
   *             properties:
   *               code:
   *                 type: string
   *               redirectUri:
   *                 type: string
   *               codeVerifier:
   *                 type: string
   *                 description: PKCE code verifier — forwarded to Keycloak when present
   *     responses:
   *       '200':
   *         description: OAuth tokens from Keycloak
   *       '400':
   *         description: Invalid request or invalid_grant from Keycloak
   *       '502':
   *         description: Keycloak unavailable or misconfigured
   *       '503':
   *         description: Contacts Keycloak not configured on this environment
   */
  router.post('(.*)/auth/contacts/token', async (ctx) => {
    if (!isContactsKeycloakConfigured()) {
      ctx.status = 503
      ctx.body = { error: 'contacts_keycloak_not_configured' }
      return
    }

    const body = readJsonBodyRecord(ctx.request.body)
    const code = body.code
    const redirectUri = body.redirectUri

    if (typeof code !== 'string' || !code) {
      ctx.status = 400
      ctx.body = { error: 'missing_authorization_code' }
      return
    }

    if (typeof redirectUri !== 'string' || !redirectUri) {
      ctx.status = 400
      ctx.body = { error: 'missing_redirect_uri' }
      return
    }

    const codeVerifier = readCodeVerifierFromBody(ctx.request.body)

    try {
      const result = await exchangeContactsAuthorizationCode(
        code,
        redirectUri,
        codeVerifier
      )
      ctx.status = 200
      ctx.body = contactsTokenToJson(result)
    } catch (error) {
      logContactsKeycloakTokenError(
        'Authentication error in /auth/contacts/token',
        error
      )
      ctx.status = httpStatusForContactsKeycloakError(error)
      ctx.body = bodyForContactsKeycloakError(ctx.status)
    }
  })

  /**
   * @swagger
   * /auth/contacts/refresh:
   *   post:
   *     summary: Refresh mimer-contacts access token
   *     description: Server-to-server helper for webapi using a Keycloak refresh token.
   *     tags:
   *       - Auth
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       '200':
   *         description: New access and refresh tokens
   *       '400':
   *         description: Invalid refresh token
   *       '502':
   *         description: Keycloak unavailable
   *       '503':
   *         description: Contacts Keycloak not configured
   */
  router.post('(.*)/auth/contacts/refresh', async (ctx) => {
    if (!isContactsKeycloakConfigured()) {
      ctx.status = 503
      ctx.body = { error: 'contacts_keycloak_not_configured' }
      return
    }

    const refreshToken = readRefreshTokenFromBody(ctx.request.body)

    if (!refreshToken) {
      ctx.status = 400
      ctx.body = { error: 'missing_refresh_token' }
      return
    }

    try {
      ctx.status = 200
      ctx.body = contactsTokenToJson(
        await refreshContactsAccessToken(refreshToken)
      )
    } catch (error) {
      logContactsKeycloakTokenError(
        'Token refresh failed in /auth/contacts/refresh',
        error
      )
      ctx.status = httpStatusForContactsKeycloakError(error)
      ctx.body = bodyForContactsKeycloakError(ctx.status)
    }
  })
}
