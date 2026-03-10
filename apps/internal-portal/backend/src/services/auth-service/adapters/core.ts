import config from '../../../common/config'
import axios from 'axios'
import { AuthAdapter, AuthOptions } from './types'

const redirectUri = config.auth.core.redirectUri
const postLogoutRedirectUri = config.auth.core.postLogoutRedirectUri

const defaultOptions: AuthOptions = {
  scopes: [],
  redirectUri,
  successRedirect: '/',
  postLogoutRedirectUri,
} as const

/**
 * Creates an AuthenticationAdapter that delegates authentication responsibilities
 * to the ONECore Core Service.
 *
 * This adapter acts as a proxy against the core service and will handle any redirects
 * internally that are not aimed at the requesting browser for the intents and purposes
 * of this implementation.
 *
 * It will override the the redirectUri of the Core authenticatio flow to redirect back
 * to this service during the flow and upon success.
 */
const coreAdapter = (options: AuthOptions = defaultOptions): AuthAdapter => {
  return {
    /**
     * Sends a login request to the ONECore Core Service, which is expected to respond
     * with a redirect to where the authentication flow begins.
     *
     * If the Core Service responds with a redirect to an `auth/redirect` URL, this
     * method will follow that redirect without informing the requesting browser, as this
     * adapter proxies the authenticatio flow of Core.
     *
     * If the Core Service responds with any other redirect URL, the browser will be
     * redirected there directly to begin the authentication flow in the browser.
     */
    async login(ctx) {
      try {
        const res = await axios.get(
          `${config.core.url}/auth/login?redirectUri=${options.redirectUri}`,
          {
            maxRedirects: 0,
            validateStatus: (s) => s === 302,
          }
        )

        if (!res.headers.location) {
          ctx.throw(
            500,
            'Core did not respond with a redirect URL on login attempt.'
          )
        }

        if (res.headers.location.includes('auth/redirect')) {
          await axios.get(res.headers.location)
          ctx.redirect(
            options.successRedirect ?? defaultOptions.successRedirect!
          )
        } else {
          ctx.redirect(res.headers.location)
        }
      } catch (err: any) {
        ctx.status = 500
        ctx.body = { message: 'Login proxy failed', details: err.message }
      }
    },

    /**
     * Delegate the logout request to Core and invalidate the current session.
     */
    async logout(ctx) {
      let redirectUrl = options.postLogoutRedirectUri ?? '/'

      try {
        const response = await axios.get(`${config.core.url}/auth/logout`, {
          maxRedirects: 0,
          validateStatus: (s) => s === 302,
        })

        redirectUrl = response.headers?.location ?? redirectUrl
      } catch {
        // Swallow failure. If we failed to log out, we're unlikely to be logged in.
      }

      ctx.session = null

      ctx.redirect(redirectUrl)
    },

    /**
     * acquireToken is not applicable for this adapter.
     */
    async acquireToken(ctx) {
      ctx.throw(501, 'Not implemented')
    },

    /**
     * handleRedirect is not applicable for this adapter.
     */
    async handleRedirect(ctx) {
      return this.handleCallback(ctx)
    },

    /**
     * Handles the callback from the authentication service containing the
     * returned authentication `code` and scoops up and proxies the request to Core to
     * finalize the authentication and retrieve user details.
     */
    async handleCallback(ctx) {
      const { code } = ctx.request.query
      if (!code) {
        ctx.throw(400, 'Missing authorization code')
      }

      try {
        const response = await axios.post(
          `${config.core.url}/auth/callback`,
          { code, redirectUri: options.redirectUri },
          {
            headers: { 'Content-Type': 'application/json' },
          }
        )

        if (!ctx.session) {
          throw new Error('Sessions need to be enabled')
        }

        ctx.session.isAuthenticated = true
        ctx.session.account = {
          ...response.data,
          username: response.data.preferred_username ?? response.data.username,
        }

        for (const cookie of response.headers['set-cookie'] ?? []) {
          const [key, value] = cookie.split('=')
          ctx.session[key] = value
        }

        ctx.redirect(options.successRedirect ?? '/')
      } catch (err: any) {
        ctx.status = err.response?.status || 500
        ctx.body = err.response?.data || { message: 'Auth callback failed' }
      }
    },
  }
}

export { coreAdapter }
