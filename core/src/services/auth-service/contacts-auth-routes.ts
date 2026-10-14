import KoaRouter from '@koa/router'
import { isAxiosError } from 'axios'
import { logger } from '@onecore/utilities'

import {
  exchangeContactsAuthorizationCode,
  isContactsKeycloakConfigured,
  refreshContactsAccessToken,
} from './keycloak-contacts'

function keycloakErrorStatus(error: unknown): number {
  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status === 400 || status === 401) {
      return 400
    }
    if (status && status >= 500) {
      return 502
    }
  }
  return 500
}

/**
 * OAuth helper routes for mimer.nu (mimer-contacts realm).
 * Returns token JSON for webapi — does not set browser cookies on core.
 */
export const registerContactsAuthRoutes = (router: KoaRouter) => {
  /**
   * @swagger
   * /auth/contacts/callback:
   *   post:
   *     summary: Exchange authorization code for mimer-contacts tokens
   *     description: Server-to-server helper for webapi. Exchanges a Keycloak authorization code using the mina-sidor confidential client.
   *     tags:
   *       - Auth
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
   *     responses:
   *       '200':
   *         description: Tokens and user profile from Keycloak
   *       '400':
   *         description: Invalid request or invalid_grant from Keycloak
   *       '503':
   *         description: Contacts Keycloak not configured on this environment
   */
  router.post('(.*)/auth/contacts/callback', async (ctx) => {
    if (!isContactsKeycloakConfigured()) {
      ctx.status = 503
      ctx.body = { error: 'contacts_keycloak_not_configured' }
      return
    }

    const { code, redirectUri } = ctx.request.body as {
      code?: unknown
      redirectUri?: unknown
    }

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

    try {
      const result = await exchangeContactsAuthorizationCode(code, redirectUri)
      ctx.status = 200
      ctx.body = result
    } catch (error) {
      logger.error(error, 'Authentication error in /auth/contacts/callback')
      ctx.status = keycloakErrorStatus(error)
      ctx.body = {
        error:
          ctx.status === 400
            ? 'invalid_grant'
            : 'contacts_token_exchange_failed',
      }
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refresh_token
   *             properties:
   *               refresh_token:
   *                 type: string
   *     responses:
   *       '200':
   *         description: New access and refresh tokens
   *       '400':
   *         description: Invalid refresh token
   *       '503':
   *         description: Contacts Keycloak not configured
   */
  router.post('(.*)/auth/contacts/refresh', async (ctx) => {
    if (!isContactsKeycloakConfigured()) {
      ctx.status = 503
      ctx.body = { error: 'contacts_keycloak_not_configured' }
      return
    }

    const { refresh_token: refreshToken } = ctx.request.body as {
      refresh_token?: unknown
    }

    if (typeof refreshToken !== 'string' || !refreshToken) {
      ctx.status = 400
      ctx.body = { error: 'missing_refresh_token' }
      return
    }

    try {
      const tokens = await refreshContactsAccessToken(refreshToken)
      ctx.status = 200
      ctx.body = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type ?? 'Bearer',
      }
    } catch (error) {
      logger.error(error, 'Token refresh failed in /auth/contacts/refresh')
      ctx.status = keycloakErrorStatus(error)
      ctx.body = {
        error:
          ctx.status === 400
            ? 'invalid_grant'
            : 'contacts_token_refresh_failed',
      }
    }
  })
}
