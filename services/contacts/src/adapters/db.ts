import { KnexConnectionParameters, makeKnexResource } from '@onecore/utilities'
import { logger } from '@onecore/utilities'

/**
 * Creates a Knex database client resource for the contacts service's own
 * database, using the defaults for pool, healthcheck and heal settings
 * from @onecore/utilities.
 */
export const contactsDbClient = (config: KnexConnectionParameters) => {
  return makeKnexResource({
    name: 'contacts-db',
    logger: logger,
    config,
  })
}
