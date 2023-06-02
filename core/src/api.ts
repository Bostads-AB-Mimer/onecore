import KoaRouter from '@koa/router'
import { routes as leaseRoutes } from './services/lease-service'

const router = new KoaRouter()

leaseRoutes(router)

export default router
