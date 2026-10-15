import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import { getOpenRentalBlocksByRentalIds } from '@src/adapters/rental-block-batch-adapter'
import { ResidencesBatchRequestSchema } from '@src/types/residence'

import { parseRequest } from '../middleware/parse-request'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Rental blocks
 *     description: Rental blocks (spärrar) on any rental object. The older block routes still live under /residences; see UTH-395.
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rental-blocks/batch:
   *   post:
   *     summary: Open rental blocks for many rental objects by rental id
   *     description: |
   *       Every block that has not ended (no end date, or end date today or
   *       later) on the given rental ids, with or without a reason. Ids
   *       without open blocks are simply absent.
   *     tags:
   *       - Rental blocks
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [rentalIds]
   *             properties:
   *               rentalIds:
   *                 type: array
   *                 minItems: 1
   *                 maxItems: 5000
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Open rental blocks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalBlock'
   *       400:
   *         description: Invalid request body
   *       500:
   *         description: Internal server error
   */
  router.post(
    '(.*)/rental-blocks/batch',
    parseRequest({ body: ResidencesBatchRequestSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const content = await getOpenRentalBlocksByRentalIds(
          ctx.request.parsedBody.rentalIds
        )
        ctx.status = 200
        ctx.body = { content, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error fetching rental blocks batch')
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )
}
