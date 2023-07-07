import KoaRouter from '@koa/router'
import { routes as leaseRoutes } from './services/lease-service'
import { routes as rentalPropertyRoutes } from './services/rental-property-service'

const router = new KoaRouter()

leaseRoutes(router)
rentalPropertyRoutes(router)

export default router
