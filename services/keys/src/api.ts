import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './services/key-service'
import { routes as swaggerRoutes } from './services/swagger'   // <— add this



const router = new KoaRouter()

keyRoutes(router)
swaggerRoutes(router)                                         // <— and this


export default router
