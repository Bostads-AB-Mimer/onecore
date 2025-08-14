import KoaRouter from '@koa/router'
import config from '../../common/config'
import { healthCheck as odooHealthCheck } from '../work-order-service/adapters/odoo-adapter'
import {
  collectDbPoolMetrics,
  DbConnection,
  HealthCheckTarget,
  pollSystemHealth,
  probe,
  SystemHealth,
} from '@onecore/utilities'
import { db as xpandDb } from '../work-order-service/adapters/xpand-adapter'

const healthChecks: Map<string, SystemHealth> = new Map()

/**
 * Round-up of DB connections used by this service
 */
const CONNECTIONS: DbConnection[] = [
  {
    name: 'xpand',
    connection: xpandDb,
  },
]

const subsystems: HealthCheckTarget[] = [
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.odoo.systemName,
        healthChecks,
        config.health.odoo.minimumMinutesBetweenRequests,
        odooHealthCheck
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
   *                   example: work-order
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
    ctx.body = await pollSystemHealth('work-order', subsystems)
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
