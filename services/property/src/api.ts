import KoaRouter from '@koa/router'
import { routes as propertiesRoutes } from './services/components'
import { routes as residencesRoutes } from './services/residences'

const router = new KoaRouter()

propertiesRoutes(router)

residencesRoutes(router)

export default router
