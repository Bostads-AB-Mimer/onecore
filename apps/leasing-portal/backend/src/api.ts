import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'
import { AppContext } from './context'
import { requireUserToken } from './middlewares/require-user-token'
import { routes as authRoutes } from './services/auth-service'

export const makeApi = (appContext: AppContext) => {
  const { config, modules } = appContext

  const koaRouter = new KoaRouter({ prefix: config.routePrefix })
  koaRouter.use(requireUserToken)

  const router = makeOkapiRouter(koaRouter, {
    openapi: {
      info: { title: `ONECore ${config.applicationName}` },
    },
  })

  authRoutes(router, modules)

  return router
}

export default makeApi
