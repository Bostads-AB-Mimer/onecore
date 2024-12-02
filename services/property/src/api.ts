import KoaRouter from '@koa/router'
import { routes as componentsRoutes } from './services/components'
import { routes as residencesRoutes } from './services/residences'
import { routes as buildingsRoutes } from './services/buildings'
import { routes as propertiesRoutes } from './services/properties'
import { routes as staircasesRoutes } from './services/staircases'

const router = new KoaRouter()

componentsRoutes(router)
residencesRoutes(router)
buildingsRoutes(router)
propertiesRoutes(router)
staircasesRoutes(router)

export default router
