import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes as infobipRoutes } from './services/infobip-service'
import { routes as healthRoutes } from './services/health-service'
import { routes as linearRoutes } from './services/linear-service'
import { routes as communicationLogRoutes } from './services/communication-log-service'

// TODO: Migrate the legacy services (infobip, linear, health) to OkapiRouter
// so they appear in the OpenAPI spec and we can drop the dual-router setup.
// While split, a workspace-level `@types/koa__router` override in root
// package.json keeps the two router type packages from conflicting.
const legacyRouter = new KoaRouter()
infobipRoutes(legacyRouter)
healthRoutes(legacyRouter)
linearRoutes(legacyRouter)

const okapi = makeOkapiRouter(new KoaRouter(), {
  openapi: {
    info: { title: 'ONECore communication' },
  },
})
communicationLogRoutes(okapi)

export default { legacy: legacyRouter, okapi }
