import { Knex } from 'knex'
import { Resource } from '@/resource'

/**
 * Wrapper for a knex instance, providing a name to go with
 * it, for presentation purposes.
 *
 * This is used to collect metrics from the connection pool
 * and is designed to be compatible with `Knex`.
 */
export interface DbConnection {
  name: string
  connection: Knex
}

export type DbResource = Resource<Knex> | DbConnection

/**
 * Payload type for Db Pool Metrics - the struct encoded into the body
 * of a db pool health check request.
 *
 * The selection of metric points are directly derived from what Knex, or
 * rather
 */
export type PoolMetrics = {
  connectionPools: number
  metrics: {
    name: string
    pool:
      | {
          used: number
          free: number
          pendingCreates: number
          pendingAcquires: number
        }
      | 'unavailable'
  }[]
}

/**
 * Collect pool metrics from all provided `connections`
 *
 * This function is designed to be used in a health check endpoint
 * to provide insights into the state of database connection pools.
 *
 * It returns a structured object containing the number of connection pools
 * and detailed metrics for each pool, including the number of used,
 * free, pending creates, and pending acquires connections.
 *
 * @param connections - An array of `DbConnection` objects representing the database connections.
 * @return A `PoolMetrics` object containing the number of connection pools and their metrics.
 *
 * @example
 * ```typescript
 * import { collectDbPoolMetrics } from '@onecore/utilities';
 *
 * const CONNECTIONS: DbConnection[] = [
 *   {
 *     name: 'leasing',
 *     connection: leasingDb,
 *   },
 *   {
 *     name: 'xpand',
 *     connection: xpandDb,
 *   },
 * ]
 *
 * router.get('(.*)/health/db', async (ctx) => {
 *   ctx.body = collectDbPoolMetrics(CONNECTIONS)
 * })
 * ```
 */
export const collectDbPoolMetrics = (
  connections: DbResource[]
): PoolMetrics => ({
  connectionPools: connections.length,
  metrics: connections.map((conn) => {
    try {
      const pool =
        'connection' in conn
          ? conn.connection.client.pool
          : conn.get().client.pool

      return {
        name: conn.name,
        pool: {
          used: pool.numUsed(),
          free: pool.numFree(),
          pendingCreates: pool.numPendingCreates(),
          pendingAcquires: pool.numPendingAcquires(),
        },
      }
    } catch {
      return {
        name: conn.name,
        pool: 'unavailable',
      }
    }
  }),
})
