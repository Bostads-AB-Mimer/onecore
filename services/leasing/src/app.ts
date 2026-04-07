import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'

import api from './api'
import { errorHandler, logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

import { koaSwagger } from 'koa2-swagger-ui'

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

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(api.routes())

export default app
