import KoaRouter from '@koa/router'
import { routes as propertyInfoRoutes } from './services/property-info-service'
import { routes as healthRoutes } from './services/health-service'
import { routes as swagggerRoutes } from './services/swagger'

const router = new KoaRouter()

healthRoutes(router)
propertyInfoRoutes(router)
swagggerRoutes(router)

export default router
