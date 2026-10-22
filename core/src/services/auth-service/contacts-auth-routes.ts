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
import {
  ContactCodeError,
  ensureContactCode,
  setContactCode,
} from './contacts-contact-code'

/**
 * Short, so that the code exchange, ensureContactCode's budget and this logout together stay
 * inside webapi's 15 s timeout in the usual case.
 */
const LOGOUT_AFTER_FAILED_LOGIN_TIMEOUT_MS = 3000

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
   *         description: Invalid request, or invalid_grant from Keycloak (also when the session ends before the token carrying contact_code is issued)
   *       '502':
   *         description: Keycloak or the contacts service unavailable or too slow (contact_lookup_unavailable); a session the exchange started is ended
   *       '503':
   *         description: Contacts Keycloak not configured on this environment (contacts_keycloak_not_configured), or contact_code needs setting and the provisioning client is not configured (contact_provisioning_not_configured; the session is ended)
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
        error instanceof ContactCodeError ? (error.cause ?? error) : error
      )

      if (reason === 'session_ended') {
        ctx.status = 400
        ctx.body = { error: 'invalid_grant' }
        return
      }

      // webapi never got these tokens, so it cannot end the session; left alive, the next
      // login on a shared computer would silently sign in as this user.
      if (exchanged.refresh_token) {
        await logoutContactsSession(
          exchanged.refresh_token,
          LOGOUT_AFTER_FAILED_LOGIN_TIMEOUT_MS
        ).catch(() =>
          logger.warn('Ending the session after a failed login failed')
        )
      }

      if (reason === 'provisioning_not_configured') {
        ctx.status = 503
        ctx.body = { error: 'contact_provisioning_not_configured' }
        return
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

  /**
   * @swagger
   * /auth/contacts/contact-code:
   *   post:
   *     summary: Point a customer's account at another contact
   *     description: Server-to-server helper for webapi. Sets contact_code on the mimer-contacts user behind the refresh token's session and returns tokens that carry it. Used when the token's contact exists but webapi will not accept it (inactive in Xpand) and webapi has picked the active contact for the same personnummer. Only a contact whose personnummer is the user's username is accepted. Does not end the session on failure; webapi does.
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
   *               - contactCode
   *             properties:
   *               refreshToken:
   *                 type: string
   *               contactCode:
   *                 type: string
   *     responses:
   *       '200':
   *         description: OAuth tokens whose access token carries the contact_code
   *       '400':
   *         description: Missing refresh token or contact code, or invalid_grant (session ended)
   *       '422':
   *         description: contact_not_found, or contact_not_owned when the contact's personnummer is not the user's
   *       '502':
   *         description: Keycloak or the contacts service unavailable or too slow
   *       '503':
   *         description: Contacts Keycloak or its provisioning client not configured
   */
  router.post('(.*)/auth/contacts/contact-code', async (ctx) => {
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

    const contactCode = readJsonBodyRecord(ctx.request.body).contactCode
    if (typeof contactCode !== 'string' || !contactCode) {
      ctx.status = 400
      ctx.body = { error: 'missing_contact_code' }
      return
    }

    try {
      ctx.status = 200
      ctx.body = contactsTokenToJson(
        await setContactCode(refreshToken, contactCode)
      )
    } catch (error) {
      const reason =
        error instanceof ContactCodeError ? error.reason : 'unknown'
      logContactsKeycloakTokenError(
        `Setting contact_code failed in /auth/contacts/contact-code (${reason})`,
        error instanceof ContactCodeError ? (error.cause ?? error) : error
      )

      switch (reason) {
        case 'session_ended':
          ctx.status = 400
          ctx.body = { error: 'invalid_grant' }
          return
        case 'contact_not_found':
        case 'contact_not_owned':
          ctx.status = 422
          ctx.body = { error: reason }
          return
        case 'provisioning_not_configured':
          ctx.status = 503
          ctx.body = { error: 'contact_provisioning_not_configured' }
          return
        default:
          ctx.status = 502
          ctx.body = { error: 'contact_lookup_unavailable' }
      }
    }
  })
}
