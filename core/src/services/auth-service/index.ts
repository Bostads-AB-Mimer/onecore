import KoaRouter from '@koa/router'
import createHttpError from 'http-errors'
import { logger } from '@onecore/utilities'

import hash from './hash'
import { createToken } from './jwt'
import auth from './keycloak'
import { requireAuth } from '../../middlewares/keycloak-auth'

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /auth/generatehash:
   *  get:
   *    summary: Generates a salt and hashes the given password using that salt.
   *    description: Generates a salt and hashes the given password using that salt. Pass cleartext password as query parameter.
   *    tags:
   *      - Auth
   *    parameters:
   *      - in: query
   *        name: password
   *        required: true
   *        type: string
   *        description: The cleartext password that should be hashed
   *    responses:
   *      '200':
   *        description: 'Hashed password and salt'
   *        schema:
   *            type: object
   *            properties:
   *              passwordHash:
   *                type: string
   *              salt:
   *                type: string
   */
  router.get('(.*)/auth/generatehash', async (ctx) => {
    const { query } = ctx

    if (!query.password) {
      ctx.status = 400
      ctx.body = { errorMessage: 'Missing parameter: password' }
      return
    }

    const saltAndHash = await hash.createSaltAndHash(query.password as string)
    ctx.body = saltAndHash
  })

  /**
   * @swagger
   * /auth/generatetoken:
   *   post:
   *     summary: Generates a JWT token
   *     description: Validates username and password from request body and returns a JWT token.
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/x-www-form-urlencoded:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       '200':
   *         description: A valid JWT token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *       '400':
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 errorMessage:
   *                   type: string
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   */
  router.post('(.*)/auth/generatetoken', async (ctx) => {
    const username = ctx.request.body?.username as string
    const password = ctx.request.body?.password as string

    if (!username || !password) {
      ctx.status = 400
      ctx.body = { errorMessage: 'Missing parameter(s): username, password' }
      return
    }

    try {
      const token = await createToken(username, password)
      ctx.body = token
    } catch (error) {
      if (createHttpError.isHttpError(error)) {
        ctx.status = (error as createHttpError.HttpError).statusCode
        ctx.body = { message: (error as createHttpError.HttpError).message }
      } else {
        ctx.status = 500
        ctx.body = { message: (error as Error).message }
      }
    }
  })

  /**
   * @swagger
   * /auth/login:
   *   get:
   *     summary: Redirects to Keycloak login
   *     description: Redirects the user to the Keycloak login page
   *     tags:
   *       - Auth
   *     responses:
   *       '302':
   *         description: Redirect to Keycloak login
   */
  router.get('(.*)/auth/login', async (ctx) => {
    const redirectUri =
      typeof ctx.request.query?.redirectUri === 'string'
        ? ctx.request.query?.redirectUri
        : `${ctx.protocol}://${ctx.host}/auth/callback`
    const keycloakLoginUrl = `${auth.keycloakUrl}/protocol/openid-connect/auth?client_id=${auth.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid`

    ctx.redirect(keycloakLoginUrl)
  })

  /**
   * @swagger
   * /auth/callback:
   *   post:
   *     summary: OAuth callback endpoint
   *     description: Handles the OAuth callback from Keycloak
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *               redirectUri:
   *                 type: string
   *     responses:
   *       '200':
   *         description: User profile information
   */
  router.post('(.*)/auth/callback', async (ctx) => {
    try {
      const { code, redirectUri } = ctx.request.body
      if (!code || typeof code !== 'string') {
        throw new Error('Missing authorization code')
      }

      // Exchange code for tokens and set cookies
      const { user } = await auth.handleTokenExchange(code, redirectUri, ctx)

      ctx.status = 200
      ctx.body = user
    } catch (error) {
      logger.error(error, 'Authentication error in /auth/callback:')
      console.log('auth error in callback route: ', error)
      if (typeof error === 'object' && error !== null && 'status' in error) {
        if (error.status === 400) {
          ctx.status = 400
          return
        } else {
          ctx.status = 500
        }
      } else {
        ctx.status = 500
      }
    }
  })

  /**
   * @swagger
   * /auth/logout:
   *   get:
   *     summary: Logout endpoint
   *     description: Clears authentication cookies and redirects to Keycloak logout
   *     tags:
   *       - Auth
   *     responses:
   *       '302':
   *         description: Redirect to login page
   */
  router.get('(.*)/auth/logout', async (ctx) => {
    // Clear cookies
    auth.logout(ctx)

    // Redirect to Keycloak logout
    const keycloakLogoutUrl = `${auth.keycloakUrl}/protocol/openid-connect/logout`

    ctx.redirect(keycloakLogoutUrl)
  })

  /**
   * @swagger
   * /auth/profile:
   *   get:
   *     summary: Get user profile
   *     description: Returns the authenticated user's profile information
   *     tags:
   *       - Auth
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: User profile information
   *       '401':
   *         description: Unauthorized
   */
  router.get('(.*)/auth/profile', requireAuth, async (ctx) => {
    ctx.body = ctx.state.user
  })

  /**
   * @swagger
   * /auth/refresh:
   *   post:
   *     summary: Refresh access token
   *     description: Uses refresh_token cookie to get new access_token
   *     tags:
   *       - Auth
   *     responses:
   *       '200':
   *         description: Token refreshed successfully
   *       '401':
   *         description: Invalid or expired refresh token
   */
  router.post('(.*)/auth/refresh', async (ctx) => {
    try {
      const refreshToken = ctx.cookies.get('refresh_token')

      if (!refreshToken) {
        ctx.status = 401
        ctx.body = { error: 'No refresh token available' }
        return
      }

      const newTokens = await auth.refreshAccessToken(refreshToken)
      auth.tokenService.setCookies(ctx, newTokens)

      ctx.status = 200
      ctx.body = { message: 'Token refreshed successfully' }
    } catch (error) {
      logger.error(error, 'Token refresh failed in /auth/refresh endpoint')
      ctx.status = 401
      ctx.body = { error: 'Token refresh failed' }
    }
  })
}
