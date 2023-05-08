import KoaRouter from '@koa/router'
import { routes as searchRoutes } from './services/search-service'

const router = new KoaRouter()

router.get('/', async (ctx) => {
  ctx.body = 'Hello world'
})

searchRoutes(router)

router.get('/echo/:param', async (ctx) => {
  ctx.body = { param: ctx.params.param }
})

router.post('/', async (ctx) => {
  ctx.body = ctx.request.body
  ctx.set('X-Iteam-Header', ctx.get('X-Iteam-Header'))
})

export default router
