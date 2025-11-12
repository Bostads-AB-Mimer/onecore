import Koa from 'koa'
import KoaRouter from '@koa/router'
import { koaBody } from 'koa-body'
import cors from '@koa/cors'
import { koaSwagger } from 'koa2-swagger-ui'

import api from './api'
import { errorHandler, logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

app.use(cors())
app.use(koaBody({ multipart: true, patchKoa: true }))

app.on('error', (err) => {
  logger.error(err, 'Uncaught error')
})

app.on('timeout', (err) => {
  logger.error(err, 'Timeout')
})

app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(errorHandler())
app.use(api.routes())

app.use(
  new KoaRouter()
    .get(api.openapiJsonUrl, async (ctx) => {
      ctx.body = api.openapiJson()
    })
    .routes()
)

app.use(
  koaSwagger({
    routePrefix: '/swagger',
    swaggerOptions: { url: api.openapiJsonUrl },
  })
)

export default app
