import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'
import config from './common/config'

import { routes as contactsRoutes } from './services/contacts-service'
import { routes as healthRoutes } from './services/health-service'
import { AppContext } from './context'

const makeApi = (appContext: AppContext) => {
  const router = makeOkapiRouter(new KoaRouter(), {
    openapi: {
      info: { title: `ONECore ${config.applicationName}` },
    },
  })

  const { infrastructure, modules } = appContext

  contactsRoutes(router, modules)
  healthRoutes(router, infrastructure)

  return router
}

export default makeApi
