import Koa from 'koa'
import Router from '@koa/router'
import { PrismaClient } from '@prisma/client'

const app = new Koa()
const router = new Router()
const prisma = new PrismaClient()
const port = 3000

router.get('/', async (ctx) => {
  ctx.body = 'hello world'
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`)
})
