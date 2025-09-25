import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import { logger, loggerMiddlewares } from '@onecore/utilities'
import api from './api'
const app = new Koa()

import { koaSwagger } from 'koa2-swagger-ui'

import { routes as swagggerRoutes } from './services/swagger'

app.use(cors())

app.use(
  koaSwagger({
    routePrefix: '/swagger',
    swaggerOptions: {
      url: '/swagger.json',
    },
  })
)

app.on('error', (err) => {
  logger.error(err)
})

app.use(bodyParser())
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

const publicRouter = new KoaRouter()
swagggerRoutes(publicRouter)
 app.use(publicRouter.routes())

app.use(api.routes())
app.use(api.allowedMethods())

export default app
