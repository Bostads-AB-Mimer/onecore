import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import cors from '@koa/cors'

import api from './api'

import { logger, loggerMiddlewares } from 'onecore-utilities'
import { koaSwagger } from 'koa2-swagger-ui'
import { routes as swaggerRoutes } from './services/swagger'

const app = new Koa()

app.use(cors())

app.use(
  koaSwagger({
    routePrefix: '/swagger',
    swaggerOptions: {
      url: '/swagger.json',
    },
  }),
)

app.on('error', (err) => {
  logger.error(err)
})

app.use(bodyParser())

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

const publicRouter = new KoaRouter()

swaggerRoutes(publicRouter)
app.use(publicRouter.routes())

app.use(api.routes())

export default app
