import KoaRouter from '@koa/router'
import { routes as infobipRoutes } from './services/infobip-service'
import { routes as healthRoutes } from './services/health-service'
import { routes as linearRoutes } from './services/linear-service'

const router = new KoaRouter()

infobipRoutes(router)
healthRoutes(router)
linearRoutes(router)

export default router
