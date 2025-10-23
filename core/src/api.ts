import KoaRouter from '@koa/router'
import { routes as leaseRoutes } from './services/lease-service'
import { routes as rentalPropertyRoutes } from './services/property-management-service'
import { routes as workOrderRoutes } from './services/work-order-service'
import { routes as propertyBaseRoutes } from './services/property-base-service'
import { routes as searchRoutes } from './services/search-service'
import { routes as economyRoutes } from './services/economy-service'

const router = new KoaRouter()

// Register all routes
leaseRoutes(router)
rentalPropertyRoutes(router)
workOrderRoutes(router)
propertyBaseRoutes(router)
searchRoutes(router)
economyRoutes(router)

export default router
