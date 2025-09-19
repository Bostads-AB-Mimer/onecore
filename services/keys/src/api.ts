import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './services/key-service'


const router = new KoaRouter()

keyRoutes(router)

export default router
