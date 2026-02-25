import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'

import api from './api'
import { errorHandler, logger, loggerMiddlewares } from '@onecore/utilities'

const app = new Koa()

app.use(cors())

app.on('error', (err) => {
  logger.error(err)
})

app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)

app.use(errorHandler())

app.use(bodyParser())
app.use(api.routes())

export default app
