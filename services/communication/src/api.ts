import KoaRouter from '@koa/router'
import { routes as emailRoutes } from './services/email-service'

const router = new KoaRouter()

emailRoutes(router)

export default router
