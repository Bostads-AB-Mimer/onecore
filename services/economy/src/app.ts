import Koa from 'koa'
import { koaBody } from 'koa-body'
import cors from '@koa/cors'

import api from './api'
import { errorHandler, logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

app.use(cors())
app.use(koaBody({ multipart: true, patchKoa: true }))

app.on('error', (err) => {
  logger.error(err, 'Uncaught error')
})

app.on('timeout', (err) => {
  logger.error(err, 'Timeout')
})

app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(errorHandler())
app.use(api.routes())

export default app
