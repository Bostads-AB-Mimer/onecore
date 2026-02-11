import { OkapiRouter } from 'koa-okapi-router'

import { routes as v1Routes } from './v1'
import { Config } from '@/common/config'

export const routes = (router: OkapiRouter, config: Config) => {
  v1Routes(router, config)
}
