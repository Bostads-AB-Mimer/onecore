import KoaRouter from '@koa/router'
import { routes as propertyInfoRoutes } from './services/property-info-service'
import { routes as healthRoutes } from './services/health-service'

const router = new KoaRouter()

propertyInfoRoutes(router)
healthRoutes(router)

export default router
