import KoaRouter from '@koa/router'

import { routes as inspectionRoutes } from './services/inspection-service'
import { routes as healthRoutes } from './services/health-service'

const router = new KoaRouter()

inspectionRoutes(router)
healthRoutes(router)

export default router
