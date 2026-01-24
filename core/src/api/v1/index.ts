import { OkapiRouter } from 'koa-okapi-router'

import { routes as contactsRoutes } from './contacts'
import { Config } from '@/common/config'

export const routes = (router: OkapiRouter, config: Config) => {
  contactsRoutes(router, config)
}
