import KoaRouter from '@koa/router'

import { routes as leaseRoutes } from './services/lease-service'
import { routes as creditSafeRoutes } from './services/creditsafe'
import { routes as healthRoutes } from './services/health-service'
import { routes as swagggerRoutes } from './services/swagger'

const router = new KoaRouter()

leaseRoutes(router)
creditSafeRoutes(router)
healthRoutes(router)
swagggerRoutes(router)

export default router
