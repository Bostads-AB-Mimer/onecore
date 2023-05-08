import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'

import api from './api'
import errorHandler from './middlewares/error-handler'

const app = new Koa()

app.use(cors())

app.on('error', (err) => {
  console.error(err)
})

app.use(errorHandler())

app.use(async (ctx, next) => {
  console.log('Hello')
  await next()
})

app.use(bodyParser())
app.use(api.routes())

export default app
