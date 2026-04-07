import { KnexConnectionParameters, makeKnexResource } from '@onecore/utilities'
import { logger } from '@onecore/utilities'

/**
 * Creates a Knex database client resource for Xpand database, using the
 * defaults for pool, healthcheck and heal settings from @onecore/utilities.
 */
export const xpandDbClient = (config: KnexConnectionParameters) => {
  return makeKnexResource({
    name: 'xpand-db',
    logger: logger,
    config,
  })
}
