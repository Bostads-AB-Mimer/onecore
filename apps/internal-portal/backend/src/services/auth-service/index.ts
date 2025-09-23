import KoaRouter from '@koa/router'
import config from '../../common/config'
import { msalAdapter } from './adapters/msal'
import { coreAdapter } from './adapters/core'
import { generateRouteMetadata } from '@onecore/utilities'
import { AuthAdapter, AuthAdapterFactory } from './adapters/types'

/**
 * Available authentication provider implementations
 *
 * The authentication provider is configured by specifying either
 * `core` or `msal` for `config.auth.adapter`/`AUTH__ADAPTER`
 */
const ADAPTERS: Record<string, AuthAdapterFactory> = {
  core: coreAdapter,
  msal: msalAdapter,
}

/**
 * Instance of conigured authentication adapter
 */
const adapter: AuthAdapter = ADAPTERS[config.auth.adapter]()

if (!adapter) {
  throw new Error('No auth adapter configured')
}

export const routes = (router: KoaRouter) => {
  router.get('(.*)/auth/login', async (ctx) => {
    await adapter.login(ctx)
  })

  router.get('(.*)/auth/logout', async (ctx) => {
    await adapter.logout(ctx)
  })

  router.post('(.*)/auth/redirect', async (ctx) => {
    await adapter.handleRedirect(ctx)
  })

  router.get('(.*)/auth/callback', async (ctx) => {
    await adapter.handleCallback(ctx)
  })

  router.get('(.*)/auth/profile', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    if (ctx.session?.isAuthenticated && ctx.session?.account) {
      const account = {
        name: ctx.session.account.name,
        username: ctx.session.account.username,
      }

      ctx.body = {
        content: {
          account,
          ...metadata,
        },
      }
    } else {
      ctx.status = 401
      ctx.body = { error: 'Unauthorized', ...metadata }
    }
  })
}
