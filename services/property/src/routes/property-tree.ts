import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import { getPropertyTree } from '../adapters/property-grouping-adapter'
import {
  PropertyGroupingSchema,
  PropertyTreeSchema,
} from '../types/property-tree'

import { parseRequest } from '../middleware/parse-request'

const GetPropertyTreeQueryParamsSchema = z
  .object({
    groupBy: PropertyGroupingSchema,
    // Cost center: uuid. Marknadsområde: babya.code. Företag: company code.
    rootId: z.string().min(1),
    // 'false' skips the rental-object leaves, for structure-only consumers.
    includeObjects: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  })
  // onecore_cost_center.id is a uniqueidentifier: a non-uuid would throw in
  // Prisma and surface as a 500 instead of this 400.
  .superRefine(({ groupBy, rootId }, ctx) => {
    if (groupBy !== 'costCenter') return
    if (z.string().uuid().safeParse(rootId).success) return
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rootId'],
      message: 'rootId must be a uuid when groupBy is costCenter',
    })
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
   *       Everything is served from in-memory caches: membership (which root
   *       holds which properties) for up to 15 minutes, the property-and-below
   *       half for up to an hour per property — so a moved property or a
   *       structural change in Xpand may take that long to appear.
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
   *         description: Cost center id (must be a uuid), market area code, or company code
   *       - in: query
   *         name: includeObjects
   *         required: false
   *         schema:
   *           type: string
   *           enum: ['true', 'false']
   *           default: 'true'
   *         description: Pass 'false' to omit the rental-object leaves
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
      const { groupBy, rootId, includeObjects } = ctx.request.parsedQuery

      try {
        const tree = await getPropertyTree(groupBy, rootId, includeObjects)
        if (!tree) {
          ctx.status = 404
          ctx.body = { reason: 'Root not found', ...metadata }
          return
        }
        const content = PropertyTreeSchema.parse(tree)
        ctx.body = { content, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error fetching property tree')
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )
}
