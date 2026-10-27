import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import compress from 'koa-compress'
import cors from '@koa/cors'
import { etagMiddleware, logger, loggerMiddlewares } from '@onecore/utilities'
import { koaSwagger } from 'koa2-swagger-ui'
import { makeOkapiRouter } from 'koa-okapi-router'
import config from './common/config'

import api from './api'
import { routes as authRoutes } from './services/auth-service'
import { routes as healthRoutes } from './services/health-service'
import { routes as infobipSmsWebhookRoutes } from './services/communication-service/infobip-sms-webhook'

import { requireAuth, requireRole } from './middlewares/keycloak-auth'
import { routes as apiRoutes } from './api/index'
import { routes as swaggerRoutes } from './services/swagger'
import { extractToken } from './middlewares/extract-token'
import { requiredRolesFor } from './middlewares/route-roles'

const app = new Koa()

// Enable proxy trust so koa picks upp forwarded headers from k8s ingress
app.proxy = true

app.use(
  cors({
    credentials: true,
  })
)

// Proxied property payloads are hundreds of KB of repetitive JSON. Brotli off:
// node's default quality 11 blocks the event loop for 100+ ms at this size.
app.use(compress({ threshold: 1024, br: false }))

// After compress in the chain, so the hash covers the uncompressed body while
// compression still applies on the way out. Core hashes what IT serves —
// composed bodies included — so upstream ETags need no forwarding.
app.use(etagMiddleware())

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
// SMS delivery-report webhook (Tele2): token-authenticated, so it lives on the
// public router and bypasses the Keycloak chain (it validates the token itself).
infobipSmsWebhookRoutes(publicRouter)
app.use(publicRouter.routes())

// Token extraction (cookie -> Bearer -> Basic Auth)
app.use(extractToken)

// Authentication — verifies the extracted token
app.use(requireAuth)

// Role-based authorization. Path/method → roles lives in route-roles.ts so
// it can be unit-tested.
app.use(async (ctx, next) =>
  requireRole(requiredRolesFor(ctx.path, ctx.method))(ctx, next)
)

// Requires 'keys-admin' in addition to 'api-access' for key deletion (single and bulk).
// Kept as a separate middleware so api-access is always checked first.
app.use(async (ctx, next) => {
  if (
    (ctx.method === 'DELETE' && /^\/keys\/[^/]+$/.test(ctx.path)) ||
    (ctx.method === 'POST' && ctx.path === '/keys/bulk-delete')
  ) {
    return requireRole('keys-admin')(ctx, next)
  }

  if (ctx.method === 'PUT' && /^\/invoices\/[^/]+\/deferral$/.test(ctx.path)) {
    return requireRole('invoice-deferral')(ctx, next)
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
