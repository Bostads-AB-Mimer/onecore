import KoaRouter from '@koa/router'
import { routes as invoiceRoutes } from './services/invoice-service'
import { routes as healthRoutes } from './services/health-service'

const router = new KoaRouter()

invoiceRoutes(router)
healthRoutes(router)

export default router
