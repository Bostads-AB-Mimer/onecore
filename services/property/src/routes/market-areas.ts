import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import { listMarketAreas } from '../adapters/market-area-adapter'
import { MarketAreaSchema } from '../types/market-area'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Market Areas
 *     description: Operations related to market areas (marknadsområden)
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /market-areas:
   *   get:
   *     summary: List all market areas
   *     description: |
   *       Returns every market area (Xpand babya, "marknadsområde"). No
   *       filters, no pagination — there are only a few dozen rows.
   *     tags:
   *       - Market Areas
   *     responses:
   *       200:
   *         description: List of market areas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MarketArea'
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/market-areas', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const areas = await listMarketAreas()
      ctx.body = {
        content: z.array(MarketAreaSchema).parse(areas),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'market-areas.get')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
