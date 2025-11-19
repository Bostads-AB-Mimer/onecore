import { OkapiRouter } from 'koa-okapi-router'

import { routes as v1Routes } from './v1'

export const routes = (router: OkapiRouter) => {
  v1Routes(router)
}
