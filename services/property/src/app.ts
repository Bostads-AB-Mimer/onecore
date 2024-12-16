import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import cors from '@koa/cors'

import api from './api'

import { logger, loggerMiddlewares } from 'onecore-utilities'
import { koaSwagger } from 'koa2-swagger-ui'
import { routes as swaggerRoutes } from './routes/swagger-route'

const app = new Koa()

// Configure CORS with specific options
app.use(
  cors({
    origin: '*', // Allow all origins
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposeHeaders: ['Content-Length', 'Date', 'X-Request-Id'],
    maxAge: 5, // Preflight requests are cached for 5 seconds
    credentials: true, // Allow credentials (cookies, authorization headers, etc)
  })
)

app.use(
  koaSwagger({
    routePrefix: '/swagger',
    swaggerOptions: {
      url: '/swagger.json',
      defaultModelsExpandDepth: '-1',
      tryItOutEnabled: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  })
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
