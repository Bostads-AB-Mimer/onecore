import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'
import config from './common/config'

import { routes as contactsRoutes } from './services/contacts-service'
import { xpandContactsRepository } from './adapters/xpand/module'
import { xpandDbClient } from './adapters/xpand/db'

const router = makeOkapiRouter(new KoaRouter(), {
  openapi: {
    info: { title: `ONECore ${config.applicationName}` },
  },
})

const modules = {
  contactsRepository: xpandContactsRepository(xpandDbClient()),
}

contactsRoutes(router, modules)

export default router
