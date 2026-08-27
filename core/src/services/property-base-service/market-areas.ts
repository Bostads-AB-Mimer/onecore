import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { z } from 'zod'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Market Areas
 *     description: Operations related to OneCore market areas (marknadsområden)
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /market-areas:
   *   get:
   *     summary: List market areas
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/market-areas', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await propertyBaseAdapter.listMarketAreas()

    if (!result.ok) {
      logger.error({ err: result.err }, 'market-areas.get')
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }

    ctx.body = {
      content: z.array(property.MarketAreaSchema).parse(result.data),
      ...metadata,
    }
  })
}
