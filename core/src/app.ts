import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import {
  logger,
  loggerMiddlewares,
  swaggerMiddleware,
} from '@onecore/utilities'
import Koa from 'koa'
import bodyParser from 'koa-body'
import jwt from 'koa-jwt'
import { koaSwagger } from 'koa2-swagger-ui'

import api from './api'
import config from './common/config'
import { routes as authRoutes } from './services/auth-service'
import { routes as healthRoutes } from './services/health-service'
import { requireAuth } from './middlewares/keycloak-auth'

const app = new Koa()

// Enable proxy trust so koa picks upp forwarded headers from k8s ingress
app.proxy = true

app.use(
  cors({
    credentials: true,
  })
)

app.use(
  koaSwagger({
    routePrefix: '/swagger',
    swaggerOptions: {
      url: '/swagger.json',
    },
  })
)

app.use(
  swaggerMiddleware({
    serviceName: '@onecore/core',
    routes: [
      `${__dirname}/services/auth-service/*.{ts,js}`,
      `${__dirname}/services/health-service/*.{ts,js}`,
      `${__dirname}/services/lease-service/*.{ts,js}`,
      `${__dirname}/services/property-management-service/*.{ts,js}`,
      `${__dirname}/services/work-order-service/*.{ts,js}`,
      `${__dirname}/services/property-base-service/*.{ts,js}`,
      `${__dirname}/services/search-service/*.{ts,js}`,
      `${__dirname}/services/economy-service/*.{ts,js}`,
    ],
  })
)

app.on('error', (err) => {
  logger.error(err)
})

app.use(bodyParser({ multipart: true }))

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

const publicRouter = new KoaRouter()

authRoutes(publicRouter)
healthRoutes(publicRouter)
app.use(publicRouter.routes())

// JWT middleware with multiple options
app.use((ctx, next) => {
  if (ctx.cookies.get('auth_token') === undefined) {
    return jwt({
      secret: config.auth.secret,
    })(ctx, next)
  }

  return requireAuth(ctx, next)
})

app.use(api.routes())

export default app
