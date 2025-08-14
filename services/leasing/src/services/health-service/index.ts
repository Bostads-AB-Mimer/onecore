import KoaRouter from '@koa/router'
import { ListingStatus } from '@onecore/types'
import {
  DbConnection,
  collectDbPoolMetrics,
  HealthCheckTarget,
  SystemHealth,
  pollSystemHealth,
  probe,
} from '@onecore/utilities'
import config from '../../common/config'
import { healthCheck as xpandSoapApiHealthCheck } from '../lease-service/adapters/xpand/xpand-soap-adapter'
import { healthCheck as creditSafeHealthCheck } from '../creditsafe/adapters/creditsafe-adapter'
import { db as leasingDb } from '../lease-service/adapters/db'
import { xpandDb } from '../lease-service/adapters/xpand/xpandDb'

const healthChecks: Map<string, SystemHealth> = new Map()

/**
 * Round-up of DB connections used by this service
 */
const CONNECTIONS: DbConnection[] = [
  {
    name: 'leasing',
    connection: leasingDb,
  },
  {
    name: 'xpand',
    connection: xpandDb,
  },
]

const subsystems: HealthCheckTarget[] = [
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.leasingDatabase.systemName,
        healthChecks,
        config.health.leasingDatabase.minimumMinutesBetweenRequests,
        async () => {
          await leasingDb.table('listing').limit(1)
        }
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.xpandDatabase.systemName,
        healthChecks,
        config.health.xpandDatabase.minimumMinutesBetweenRequests,
        async () => {
          await xpandDb.table('cmctc').limit(1)
        }
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.expiredListingsScript.systemName,
        healthChecks,
        config.health.expiredListingsScript.minimumMinutesBetweenRequests,
        async () => {
          const expiredActiveListings = await leasingDb('listing')
            .where('PublishedTo', '<', new Date(Date.now() - 86400000))
            .andWhere('Status', ListingStatus.Active)

          if (expiredActiveListings.length > 0) {
            throw new ReferenceError(
              `Found ${expiredActiveListings.length} listings that should be expired but are still active.`
            )
          }
        },
        'All expired listings are correctly marked as expired.'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.xpandSoapApi.systemName,
        healthChecks,
        config.health.xpandSoapApi.minimumMinutesBetweenRequests,
        xpandSoapApiHealthCheck
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.creditsafe.systemName,
        healthChecks,
        config.health.creditsafe.minimumMinutesBetweenRequests,
        creditSafeHealthCheck
      )
    },
  },
]

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Health
 *     description: Operations related to service health
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Check system health status
   *     tags:
   *       - Health
   *     description: Retrieves the health status of the system and its subsystems.
   *     responses:
   *       '200':
   *         description: Successful response with system health status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                   example: core
   *                   description: Name of the system.
   *                 status:
   *                   type: string
   *                   example: active
   *                   description: Overall status of the system ('active', 'impaired', 'failure', 'unknown').
   *                 subsystems:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                         description: Name of the subsystem.
   *                       status:
   *                         type: string
   *                         enum: ['active', 'impaired', 'failure', 'unknown']
   *                         description: Status of the subsystem.
   *                       details:
   *                         type: string
   *                         description: Additional details about the subsystem status.
   */
  router.get('(.*)/health', async (ctx) => {
    ctx.body = await pollSystemHealth('leasing', subsystems)
  })

  /**
   * @openapi
   * /health/db:
   *   get:
   *     summary: Database connection pool metrics
   *     tags: [Health]
   *     responses:
   *       '200':
   *         description: Connection pool stats per configured DB connection.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 connectionPools:
   *                   type: integer
   *                   minimum: 0
   *                 metrics:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                       pool:
   *                         type: object
   *                         properties:
   *                           used: { type: integer, minimum: 0 }
   *                           free: { type: integer, minimum: 0 }
   *                           pendingCreates: { type: integer, minimum: 0 }
   *                           pendingAcquires: { type: integer, minimum: 0 }
   *             examples:
   *               sample:
   *                 value:
   *                   connectionPools: 2
   *                   metrics:
   *                     - name: "primary"
   *                       pool: { used: 3, free: 5, pendingCreates: 0, pendingAcquires: 1 }
   *                     - name: "reporting"
   *                       pool: { used: 0, free: 8, pendingCreates: 0, pendingAcquires: 0 }
   */
  router.get('(.*)/health/db', async (ctx) => {
    ctx.body = collectDbPoolMetrics(CONNECTIONS)
  })
}
