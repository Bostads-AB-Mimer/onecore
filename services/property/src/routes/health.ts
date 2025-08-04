import KoaRouter from '@koa/router'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
  router.get('/health', async (ctx) => {
    const serviceName = 'property-base'

    try {
      await prisma.$connect()
      ctx.status = 200
      ctx.body = { name: serviceName, status: 'active' }
    } catch (error) {
      ctx.status = 500
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      ctx.body = {
        name: serviceName,
        status: 'inactive',
        error: errorMessage,
        message: 'Do you have the VPN running?',
      }
    } finally {
      await prisma.$disconnect()
    }
  })
}
