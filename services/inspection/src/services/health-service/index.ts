import KoaRouter from '@koa/router'
import {
  probe,
  SystemHealth,
  HealthCheckTarget,
  pollSystemHealth,
} from '@onecore/utilities'

const healthChecks: Map<string, SystemHealth> = new Map()

const subsystems: HealthCheckTarget[] = [
  // Add subsystem health checks here as needed
  // Example:
  // {
  //   probe: async (): Promise<SystemHealth> => {
  //     return await probe(
  //       config.health.inspectionDatabase.systemName,
  //       healthChecks,
  //       config.health.inspectionDatabase.minimumMinutesBetweenRequests,
  //       async () => {
  //         // Database health check logic
  //       }
  //     )
  //   },
  // },
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
   *                   example: inspection
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
    ctx.body = await pollSystemHealth('inspection', subsystems)
  })
}
