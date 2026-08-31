import Koa from 'koa'
import KoaRouter from '@koa/router'
import koaBody from 'koa-body'
import cors from '@koa/cors'
import { koaSwagger } from 'koa2-swagger-ui'

import api from './api'
import { errorHandler, logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

app.use(cors())

app.on('error', (err) => {
  logger.error(err)
})

app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(errorHandler())

app.use(
  koaBody({
    multipart: true,
    jsonLimit: '50mb',
  })
)
app.use(api.legacy.routes())
app.use(api.okapi.routes())

app.use(
  new KoaRouter()
    .get(api.okapi.openapiJsonUrl, async (ctx) => {
      ctx.body = api.okapi.openapiJson()
    })
    .routes()
)

app.use(
  koaSwagger({
    routePrefix: '/swagger',
    swaggerOptions: { url: api.okapi.openapiJsonUrl },
  })
)

export default app
