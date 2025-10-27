import Koa from 'koa'
import bodyParser from 'koa-body'
import cors from '@koa/cors'
import {
  logger,
  loggerMiddlewares,
  swaggerMiddleware,
} from '@onecore/utilities'
import { koaSwagger } from 'koa2-swagger-ui'

import api from './api'
import { registerSchemas } from './routes/swagger'

const app = new Koa()

registerSchemas()
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
      tryItOutEnabled: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  })
)

app.use(
  swaggerMiddleware({
    serviceName: '@onecore/property',
    routes: [
      `${__dirname}/routes/components.{ts,js}`,
      `${__dirname}/routes/residences.{ts,js}`,
      `${__dirname}/routes/buildings.{ts,js}`,
      `${__dirname}/routes/properties.{ts,js}`,
      `${__dirname}/routes/parking-spaces.{ts,js}`,
      `${__dirname}/routes/staircases.{ts,js}`,
      `${__dirname}/routes/rooms.{ts,js}`,
      `${__dirname}/routes/companies.{ts,js}`,
      `${__dirname}/routes/maintenance-units.{ts,js}`,
      `${__dirname}/routes/facilities.{ts,js}`,
      `${__dirname}/routes/health.{ts,js}`,
      `${__dirname}/routes/swagger.{ts,js}`,
    ],
  })
)

app.on('error', (err) => {
  logger.error(err)
})

app.use(bodyParser())

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(api.routes())

export default app
