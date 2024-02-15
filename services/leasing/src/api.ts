import KoaRouter from '@koa/router'
import { routes as leaseRoutes } from './services/lease-service'
import { routes as creditSafeRoutes } from './services/creditsafe'

const router = new KoaRouter()

leaseRoutes(router)
creditSafeRoutes(router)

export default router
