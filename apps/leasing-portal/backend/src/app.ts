import Koa from 'koa'
import KoaRouter from '@koa/router'
import { koaBody } from 'koa-body'
import cors from '@koa/cors'
import { koaSwagger } from 'koa2-swagger-ui'
import { errorHandler, logger } from '@onecore/utilities'

import makeApi from './api'
import { AppContext } from './context'
import { routes as healthRoutes } from './services/health-service'

export const makeApp = (appContext: AppContext) => {
  const { config } = appContext
  const app = new Koa()

  // The portal hosts call us cross-origin and must be allowed to send core's cookie.
  app.use(cors({ credentials: true }))
  app.use(koaBody({ patchKoa: true }))

  app.on('error', (err) => {
    logger.error(err, 'Uncaught error')
  })

  appContext.infrastructure.middlewares.forEach((mw) => {
    app.use(mw)
  })

  app.use(errorHandler())

  const publicRouter = new KoaRouter()
  healthRoutes(publicRouter, appContext)
  app.use(publicRouter.routes())

  const api = makeApi(appContext)
  app.use(api.routes())
  app.use(api.allowedMethods())

  // Everything lives under the prefix: only that path is routed to us in the cluster.
  // Paths in the spec stay prefix-free; `servers` carries the prefix instead.
  const openapiJsonUrl = `${config.routePrefix}/openapi.json`
  app.use(
    new KoaRouter()
      .get(openapiJsonUrl, async (ctx) => {
        ctx.body = {
          ...api.openapiJson(),
          servers: [{ url: config.routePrefix }],
        }
      })
      .routes()
  )

  app.use(
    koaSwagger({
      routePrefix: `${config.routePrefix}/swagger`,
      swaggerOptions: { url: openapiJsonUrl },
    })
  )

  return app
}

export default makeApp
