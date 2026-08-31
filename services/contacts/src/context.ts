import { loggerMiddlewares, type Resource } from '@onecore/utilities'
import { Knex } from 'knex'
import { Config } from './common/config'
import { ContactsRepository, xpandContactsRepository } from './adapters'
import { xpandDbClient } from './adapters/xpand/db'
import Koa from 'koa'

/**
 * The Application Context for the Contacts Application,
 */
export interface AppContext {
  /**
   * The bare Application Configuration
   */
  config: Config
  /**
   * Application infrastructure components
   */
  infrastructure: {
    /**
     * Knex database connection for the Xpand database
     */
    xpandDb: Resource<Knex>
    /**
     * Configurable Koa middlewares.
     */
    middlewares: Koa.Middleware[]
  }
  /**
   * The Application modules
   */
  modules: {
    /**
     * The ContactsRepository implementation to use.
     */
    contactsRepository: ContactsRepository
  }
}

/**
 * Type describing the infrastructure shape of the ApplicationContext.
 */
export type AppInfrastructure = AppContext['infrastructure']

/**
 * Type describing the modules shape of the ApplicationContext.
 */
export type AppModules = AppContext['modules']

/**
 * Construct an ApplicationContext from a Config instance.
 */
export const makeAppContext = (config: Config): AppContext => {
  const xpandDb = xpandDbClient(config.xpandDatabase)

  /**
   * Attach logger middlewares if logging is enabled.
   *
   * This allows disabling these middlewares for testing purposes.
   * `config.logging.enabled` defaults to `true`, and should always
   * be enabled unless explicitly disabled.
   */
  const middlewares = config.logging.enabled
    ? [loggerMiddlewares.pre, loggerMiddlewares.post]
    : []

  /**
   * Return a concrete ApplicationContext, from which to wire up
   * the application.
   */
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
