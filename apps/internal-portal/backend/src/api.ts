import KoaRouter from '@koa/router'
import { routes as propertyInfoRoutes } from './services/property-info-service'
import { routes as leasesRoutes } from './services/leasing-service'

const router = new KoaRouter()

propertyInfoRoutes(router)
leasesRoutes(router)

export default router
