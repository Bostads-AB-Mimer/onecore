import KoaRouter from '@koa/router'
import { routes as leaseRoutes } from './services/lease-service'
import { routes as rentalPropertyRoutes } from './services/property-management-service'
import { routes as ticketingRoutes } from './services/ticketing-service'

const router = new KoaRouter()

leaseRoutes(router)
rentalPropertyRoutes(router)
ticketingRoutes(router)

export default router
