import KoaRouter from '@koa/router'

import { routes as workOrderRoutes } from './services/work-order-service'
import { routes as healthRoutes } from './services/health-service'
import { routes as swaggerRoutes } from './services/swagger'

const router = new KoaRouter()

workOrderRoutes(router)
healthRoutes(router)
swaggerRoutes(router)

export default router
