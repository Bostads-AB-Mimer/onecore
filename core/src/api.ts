import KoaRouter from '@koa/router'
import { routes as leaseRoutes } from './services/lease-service'
import { routes as rentalPropertyRoutes } from './services/property-management-service'

const router = new KoaRouter()

leaseRoutes(router)
rentalPropertyRoutes(router)

export default router
