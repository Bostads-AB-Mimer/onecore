import Koa from 'koa'
import { loggerMiddlewares } from '@onecore/utilities'
import { Config } from './common/config'
import { CoreClient, makeCoreClient } from './adapters/core-adapter'

export interface AppContext {
  config: Config
  infrastructure: {
    middlewares: Koa.Middleware[]
  }
  modules: {
    coreClient: CoreClient
  }
}

export type AppInfrastructure = AppContext['infrastructure']
export type AppModules = AppContext['modules']

/** `overrides` lets tests swap modules, e.g. a fake core client. */
export const makeAppContext = (
  config: Config,
  overrides: Partial<AppModules> = {}
): AppContext => ({
  config,
  infrastructure: {
    middlewares: config.logging.enabled
      ? [loggerMiddlewares.pre, loggerMiddlewares.post]
      : [],
  },
  modules: {
    coreClient: makeCoreClient(config.core),
    ...overrides,
  },
})
