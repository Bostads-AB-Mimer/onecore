import { Knex } from 'knex'
import { Resource } from './common/resource'
import { ContactsRepository, xpandContactsRepository } from './adapters'
import { xpandDbClient } from './adapters/xpand/db'

export interface AppContext {
  infrastructure: {
    xpandDb: Resource<Knex>
  }
  modules: {
    contactsRepository: ContactsRepository
  }
}

export type AppInfrastructure = AppContext['infrastructure']
export type AppModules = AppContext['modules']

export const makeAppContext = (): AppContext => {
  const xpandDb = xpandDbClient()

  return {
    infrastructure: {
      xpandDb,
    },
    modules: {
      contactsRepository: xpandContactsRepository(xpandDb),
    },
  }
}
