import KoaRouter from '@koa/router'
import { routes as propertiesRoutes } from './services/components'

const router = new KoaRouter()

propertiesRoutes(router)

export default router
