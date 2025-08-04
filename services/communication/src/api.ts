import KoaRouter from '@koa/router'
import { routes as infobipRoutes } from './services/infobip-service'
import { routes as healthRoutes } from './services/health-service'

const router = new KoaRouter()

infobipRoutes(router)
healthRoutes(router)

export default router
