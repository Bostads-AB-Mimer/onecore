import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'

import {
  exchangeContactsAuthorizationCode,
  isContactsKeycloakConfigured,
  logoutContactsSession,
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
import { ContactCodeError, ensureContactCode } from './contacts-contact-code'

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
   *     description: Server-to-server helper for webapi. Exchanges a Keycloak authorization code using the mina-sidor confidential client, then makes sure the access token carries the contact_code of an existing contact (set from the personnummer when missing or stale). Without a contact for the personnummer the tokens have no contact_code.
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
   *         description: Keycloak or the contacts service unavailable; a session the exchange started is ended
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

    let exchanged
    try {
      exchanged = await exchangeContactsAuthorizationCode(
        code,
        redirectUri,
        codeVerifier
      )
    } catch (error) {
      logContactsKeycloakTokenError(
        'Authentication error in /auth/contacts/token',
        error
      )
      ctx.status = httpStatusForContactsKeycloakError(error)
      ctx.body = bodyForContactsKeycloakError(ctx.status)
      return
    }

    try {
      ctx.status = 200
      ctx.body = contactsTokenToJson(await ensureContactCode(exchanged))
    } catch (error) {
      const reason =
        error instanceof ContactCodeError ? error.reason : 'unknown'
      logContactsKeycloakTokenError(
        `Setting contact_code failed in /auth/contacts/token (${reason})`,
        error instanceof ContactCodeError ? error.cause : error
      )
      // webapi never got these tokens, so it cannot end the session; left alive, the next
      // login on a shared computer would silently sign in as this user.
      if (exchanged.refresh_token) {
        await logoutContactsSession(exchanged.refresh_token).catch(() =>
          logger.warn('Ending the session after a failed login failed')
        )
      }
      ctx.status = 502
      ctx.body = { error: 'contact_lookup_unavailable' }
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

  /**
   * @swagger
   * /auth/contacts/logout:
   *   post:
   *     summary: End a mimer-contacts Keycloak session
   *     description: Server-to-server helper for webapi. Revokes the refresh token and ends its Keycloak session.
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
   *       '204':
   *         description: Session ended
   *       '400':
   *         description: Missing refresh token, or invalid_grant (already ended or expired)
   *       '502':
   *         description: Keycloak unavailable
   *       '503':
   *         description: Contacts Keycloak not configured
   */
  router.post('(.*)/auth/contacts/logout', async (ctx) => {
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
      await logoutContactsSession(refreshToken)
      ctx.status = 204
    } catch (error) {
      logContactsKeycloakTokenError(
        'Logout failed in /auth/contacts/logout',
        error
      )
      ctx.status = httpStatusForContactsKeycloakError(error)
      ctx.body = bodyForContactsKeycloakError(ctx.status)
    }
  })
}
