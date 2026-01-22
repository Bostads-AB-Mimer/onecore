import { Knex } from 'knex'
import { Resource } from './common/resource'
import { Config } from './common/config'
import { ContactsRepository, xpandContactsRepository } from './adapters'
import { xpandDbClient } from './adapters/xpand/db'
import { loggerMiddlewares } from '@onecore/utilities'
import Koa from 'koa'

export interface AppContext {
  config: Config
  infrastructure: {
    xpandDb: Resource<Knex>
    middlewares: Koa.Middleware[]
  }
  modules: {
    contactsRepository: ContactsRepository
  }
}

export type AppInfrastructure = AppContext['infrastructure']
export type AppModules = AppContext['modules']

export const makeAppContext = (config: Config): AppContext => {
  const xpandDb = xpandDbClient(config.xpandDatabase)

  const middlewares = config.logging.enabled
    ? [loggerMiddlewares.pre, loggerMiddlewares.post]
    : []

  return {
    config: config,
    infrastructure: {
      xpandDb,
      middlewares: middlewares,
    },
    modules: {
      contactsRepository: xpandContactsRepository(xpandDb),
    },
  }
}
