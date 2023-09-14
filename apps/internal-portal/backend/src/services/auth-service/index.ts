import KoaRouter from '@koa/router'
import { login, handleRedirect, logout } from './adapters/msal'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/auth/login', async (ctx) => {
    await login()(ctx)
  })

  router.get('(.*)/auth/logout', async (ctx) => {
    await logout()(ctx)
  })

  router.post('(.*)/auth/redirect', async (ctx) => {
    await handleRedirect()(ctx)
  })

  router.get('(.*)/auth/profile', async (ctx) => {
    if (ctx.session?.isAuthenticated && ctx.session?.account) {
      const account = {
        name: ctx.session.account.name,
        username: ctx.session.account.username,
      }

      ctx.body = {
        account,
      }
    } else {
      ctx.status = 401
    }
  })
}
