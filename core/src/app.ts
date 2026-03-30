import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import cors from '@koa/cors'
import { logger, loggerMiddlewares } from '@onecore/utilities'
import { koaSwagger } from 'koa2-swagger-ui'
import { makeOkapiRouter } from 'koa-okapi-router'
import { config } from './common/config'

import api from './api'
import { routes as authRoutes } from './services/auth-service'
import { routes as healthRoutes } from './services/health-service'

import { requireAuth, requireRole } from './middlewares/keycloak-auth'
import { routes as apiRoutes } from './api/index'
import { routes as swaggerRoutes } from './services/swagger'
import { extractToken } from './middlewares/extract-token'

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

app.on('error', (err) => {
  logger.error(err)
})

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

// Body parsing for JSON routes (binary routes like /scan-receipt are naturally skipped
// since koa-body only parses matching content types like application/json)
app.use(bodyParser({ multipart: true, jsonLimit: '50mb' }))

// Public routes (no auth required)
const publicRouter = new KoaRouter()

authRoutes(publicRouter)
healthRoutes(publicRouter)
app.use(publicRouter.routes())

// Token extraction (cookie -> Bearer -> Basic Auth)
app.use(extractToken)

// Authentication — verifies the extracted token
app.use(requireAuth)

// Role-based authorization
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/scan-receipt')) {
    return requireRole('scanner-upload')(ctx, next)
  }
  return requireRole('api-access')(ctx, next)
})

// Requires 'keys-admin' in addition to 'api-access' for key deletion (single and bulk).
// Kept as a separate middleware so api-access is always checked first.
app.use(async (ctx, next) => {
  if (
    (ctx.method === 'DELETE' && /^\/keys\/[^/]+$/.test(ctx.path)) ||
    (ctx.method === 'POST' && ctx.path === '/keys/bulk-delete')
  ) {
    return requireRole('keys-admin')(ctx, next)
  }
  return next()
})

app.use(api.routes())

const apiRouter = makeOkapiRouter(new KoaRouter(), {
  openapi: {
    info: { title: `ONECore API` },
  },
})

apiRoutes(apiRouter, config)

app.use(apiRouter.routes())

swaggerRoutes(publicRouter, apiRouter)

export default app
