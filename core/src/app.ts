import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import cors from '@koa/cors'

import api from './api'
import { routes as authRoutes } from './services/auth-service'
import { routes as healthRoutes } from './services/health-service'

import { logger, loggerMiddlewares } from '@onecore/utilities'
import { koaSwagger } from 'koa2-swagger-ui'
import { routes as swaggerRoutes } from './services/swagger'
import { extractToken } from './middlewares/extract-token'
import { requireAuth, requireRole } from './middlewares/keycloak-auth'

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
swaggerRoutes(publicRouter)
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

app.use(api.routes())

export default app
