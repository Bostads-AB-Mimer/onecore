import KoaRouter from '@koa/router'

import { routes as workOrderRoutes } from './services/work-order-service'
import { routes as healthRoutes } from './services/health-service'

const router = new KoaRouter()

workOrderRoutes(router)
healthRoutes(router)

export default router
