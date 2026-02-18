import { msInterval, type Unit } from './interval'
import knex, { Knex } from 'knex'
import { Logger, makeResource } from './resource'
import { HealOptions } from './heal-strategy'

/**
 * Standard type for Knex database connections, which includes the health
 * check intervals.
 *
 * Health check intervals have previously been a concern of the health check endpoint
 * of each application. With the Resource concept, the responsibility for the health checks
 * have moved to the Resources themselves, and the health check endpoints are simply
 * consumers of the Resource state and neither trigger health checks nor manage the
 * health check intervals.
 */
export type KnexConnectionParameters = {
  host: string
  user: string
  password: string
  port: number | string
  database: string
  healthCheckInterval?: number
  healthCheckTimeUnit?: Unit
}

/**
 * Creates a Knex Resource with the given configuration.
 *
 * This is a convenience wrapper around makeResource that creates a Resource<Knex>
 * with sane defaults. Applications should typically not override/pass the optional
 * parameters unless there is a good reason or it wants to experiment with potentially
 * better defaults.
 *
 * If these defaults turn out to not be the defaults suitable for the platform, we
 * should change THESE defaults rather than introducing settings drift across applications
 * when they start defining their own sets.
 */
export const makeKnexResource = ({
  name,
  config,
  logger,
  pool,
  check,
  heal,
  teardown,
}: {
  name: string
  config: KnexConnectionParameters
  logger?: Logger
  pool?: {}
  check?: (knex: Knex) => Promise<boolean>
  heal?: HealOptions
  teardown?: (knex: Knex) => Promise<void>
}) => {
  /**
   * Use default healthcheck implementation of verifying that a simple query
   * can be executed, with no regards to the actual schema. Fine for 99.9% of
   * cases, and does not need to be overriden unless we want to explicitly test
   * for the presence of particular tables/rows/entities/whatnot.
   */
  check =
    check ??
    (async (knex: Knex) => {
      await knex.raw('SELECT 1')
      return true
    })

  /**
   * Default pool settings. Applications should generally go with these, and if
   * we want to change the default pool settings across the platform, we should
   * do that HERE.
   */
  pool = pool ?? {
    min: 1,
    max: 20,
    idleTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
  }

  /**
   * Default industry-standard backoff. Allows for a short series of quick attempts
   * to re-connect in case of a short network hiccup, which then settles on retries on
   * a 1 minute interval in case of longer outages.
   */
  heal = heal ?? {
    strategy: 'exponential-backoff',
    timeUnit: 's',
    initialDelay: 1,
    maxInterval: 60,
  }

  /**
   * Simply call knex.destroy().
   */
  teardown =
    teardown ??
    (async (knex: Knex) => {
      try {
        await knex.destroy()
      } catch {
        console.error(
          `Teardown and clean-up of Knex Resource "${name}" failed.`
        )
      }
    })

  /**
   * Construct and return the Resource.
   */
  return makeResource<Knex>({
    name,
    logger,
    autoInit: true,
    initialize: async () => {
      return knex({
        client: 'mssql',
        connection: {
          host: config.host,
          user: config.user,
          password: config.password,
          port: Number(config.port),
          database: config.database,
        },
        pool: pool,
      })
    },
    healthcheck: {
      interval: msInterval(
        config.healthCheckInterval ?? 1,
        config.healthCheckTimeUnit ?? 'm'
      ),
      intervalUnit: 'ms',
      check,
    },
    heal,
    teardown,
  })
}
