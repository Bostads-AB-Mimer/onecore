import Koa from 'koa'
import Router from '@koa/router'

const app = new Koa()
const router = new Router()
const port = 3000

router.get('/', async (ctx) => {
    ctx.body = "hello world"
})

app
    .use(router.routes())
    .use(router.allowedMethods())

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
