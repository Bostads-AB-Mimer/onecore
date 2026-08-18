import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import compress from 'koa-compress'
import cors from '@koa/cors'

import api from './api'

import { etagMiddleware, logger, loggerMiddlewares } from '@onecore/utilities'
import { koaSwagger } from 'koa2-swagger-ui'
import { routes as swaggerRoutes } from './routes/swagger'

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

// Tree and rental-object payloads are hundreds of KB of highly repetitive JSON;
// gzip takes them to a few percent of that. Brotli is off on purpose — node's
// default quality 11 blocks the event loop for 100+ ms on payloads this size.
app.use(compress({ threshold: 1024, br: false }))

// After compress in the chain, so the hash covers the uncompressed body while
// compression still applies on the way out. App-wide: every JSON route gets
// revalidation, and no route module depends on registration order anymore.
app.use(etagMiddleware())

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

const koaBodyMiddleware = bodyParser({
  multipart: false,
  urlencoded: true,
})

app.use(async (ctx, next) => {
  const contentType = ctx.request.headers['content-type'] || ''
  if (contentType.includes('multipart/form-data')) {
    return await next()
  }

  return await koaBodyMiddleware(ctx, next)
})

app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

const publicRouter = new KoaRouter()

swaggerRoutes(publicRouter)
app.use(publicRouter.routes())

app.use(api.routes())

export default app
