import KoaRouter from '@koa/router'

import { routes as componentsRoutes } from './routes/components'
import { routes as residencesRoutes } from './routes/residences'
import { routes as buildingsRoutes } from './routes/buildings'
import { routes as propertiesRoutes } from './routes/properties'
import { routes as parkingSpacesRoutes } from './routes/parking-spaces'
import { routes as staircasesRoutes } from './routes/staircases'
import { routes as roomsRoutes } from './routes/rooms'
import { routes as companiesRoutes } from './routes/companies'
import { routes as maintenanceUnitsRoutes } from './routes/maintenance-units'
import { routes as facilitiesRoutes } from './routes/facilities'

import { routes as healthRoutes } from './routes/health'

const router = new KoaRouter()

componentsRoutes(router)
residencesRoutes(router)
buildingsRoutes(router)
propertiesRoutes(router)
parkingSpacesRoutes(router)
staircasesRoutes(router)
roomsRoutes(router)
companiesRoutes(router)
maintenanceUnitsRoutes(router)
facilitiesRoutes(router)
healthRoutes(router)

export default router
