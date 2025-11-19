import { OkapiRouter } from 'koa-okapi-router'

import { routes as contactsRoutes } from './contacts'

export const routes = (router: OkapiRouter) => {
  contactsRoutes(router)
}
