import Koa from 'koa'
import koaBody from 'koa-body'
import cors from '@koa/cors'

import api from './api'
import errorHandler from './middlewares/error-handler'
import { logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

app.use(cors())

app.on('error', (err) => {
  logger.error(err)
})

app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(errorHandler())

app.use(
  koaBody({
    multipart: true,
    jsonLimit: '50mb',
  })
)
app.use(api.routes())

export default app
