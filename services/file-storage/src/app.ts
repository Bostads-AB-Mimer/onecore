import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'

import api from './api'
import errorHandler from './middlewares/error-handler'
import { logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

import { koaSwagger } from 'koa2-swagger-ui'
import { swaggerMiddleware } from './middlewares/swagger-middleware'

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

app.use(errorHandler())

app.use(bodyParser())

app.use(
  swaggerMiddleware({
    serviceName: '@onecore/file-storage',
    routes: [
      `${__dirname}/services/health-service/*.{ts,js}`,
      `${__dirname}/services/file-storage-service/*.{ts,js}`,
    ],
  })
)

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(api.routes())

export default app
