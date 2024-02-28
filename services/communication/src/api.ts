import KoaRouter from '@koa/router'
import { routes as infobipRoutes } from './services/infobip-service'

const router = new KoaRouter()

infobipRoutes(router)

export default router
