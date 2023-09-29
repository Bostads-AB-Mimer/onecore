import KoaRouter from '@koa/router'
import { routes as propertyInfoRoutes } from './services/property-info-service'

const router = new KoaRouter()

propertyInfoRoutes(router)

export default router
