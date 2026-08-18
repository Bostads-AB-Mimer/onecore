import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  getPropertyTree,
  listMarketAreas,
} from '../adapters/property-grouping-adapter'
import {
  MarketAreaSummarySchema,
  PropertyGroupingSchema,
  PropertyTreeSchema,
} from '../types/property-tree'

import { parseRequest } from '../middleware/parse-request'

const GetPropertyTreeQueryParamsSchema = z.object({
  groupBy: PropertyGroupingSchema,
  // Cost center: uuid. Marknadsområde: babya.code. Företag: company code.
  rootId: z.string().min(1),
})

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property Tree
 *     description: Property hierarchy, organised by any supported grouping
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /market-areas:
   *   get:
   *     summary: List marknadsområden
   *     description: |
   *       All market areas (babya) that have at least one property in an
   *       operating company. Sold stock (company 999) is excluded, so this
   *       list matches what the property tree can actually return.
   *     tags:
   *       - Property Tree
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
   *                     $ref: '#/components/schemas/MarketAreaSummary'
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/market-areas', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await listMarketAreas()
      ctx.body = {
        content: rows.map((r) => MarketAreaSummarySchema.parse(r)),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'Error fetching market areas')
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /property-tree:
   *   get:
   *     summary: Get the property tree for one grouping root
   *     description: |
   *       Returns properties (with buildings, trapphus, parkeringsområden and
   *       per-type counts) beneath one grouping root. `groups` carries the
   *       intermediate level when the grouping has one — KVV-areas for
   *       costCenter — and `properties` carries them directly otherwise.
   *
   *       Only stock belonging to an operating company is returned: Xpand
   *       moves sold properties to company 999 rather than delete-marking
   *       them, so they are filtered out here.
   *
   *       Membership is read fresh per request; the property-and-below half is
   *       cached in-memory per property for up to one hour, so structural
   *       changes in Xpand may take that long to appear.
   *     tags:
   *       - Property Tree
   *     parameters:
   *       - in: query
   *         name: groupBy
   *         required: true
   *         schema:
   *           type: string
   *           enum: [costCenter, marketArea, company]
   *       - in: query
   *         name: rootId
   *         required: true
   *         schema:
   *           type: string
   *         description: Cost center id (uuid), market area code, or company code
   *     responses:
   *       200:
   *         description: Property tree
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/PropertyTree'
   *       400:
   *         description: Invalid query parameters
   *       404:
   *         description: Root not found
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/property-tree',
    parseRequest({ query: GetPropertyTreeQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { groupBy, rootId } = ctx.request.parsedQuery

      try {
        const tree = await getPropertyTree(groupBy, rootId)
        if (!tree) {
          ctx.status = 404
          ctx.body = { reason: 'Root not found', ...metadata }
          return
        }
        ctx.body = {
          content: PropertyTreeSchema.parse(tree),
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'Error fetching property tree')
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )
}
