import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { z } from 'zod'

import {
  getCostCenterTreeById,
  listCostCenters,
} from '../adapters/cost-center-adapter'
import {
  CostCenterSummarySchema,
  CostCenterTreeSchema,
} from '../types/cost-center'

const PathParamsSchema = z.object({ id: z.string().uuid() })

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Cost Centers
 *     description: Operations related to OneCore-owned cost centers (förvaltningsområden)
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /cost-centers:
   *   get:
   *     summary: List all cost centers
   *     description: Returns a minimal list of all OneCore cost centers, sorted by code. Used to populate select lists.
   *     tags:
   *       - Cost Centers
   *     responses:
   *       200:
   *         description: List of cost centers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CostCenterSummary'
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/cost-centers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await listCostCenters()
      ctx.body = {
        content: rows.map((r) => CostCenterSummarySchema.parse(r)),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /cost-centers/{id}/tree:
   *   get:
   *     summary: Get the management tree for a cost center
   *     description: |
   *       Returns the cost center, its KVV areas, properties (with addresses and
   *       aggregate counts) and the Keycloak user IDs for lead, deputy and
   *       responsible. Keycloak user details are NOT expanded here — that
   *       composition happens in core.
   *     tags:
   *       - Cost Centers
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The cost center id
   *     responses:
   *       200:
   *         description: Cost center tree
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/CostCenterTree'
   *       404:
   *         description: Cost center not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/cost-centers/:id/tree', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = PathParamsSchema.safeParse(ctx.params)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { reason: 'Invalid id', ...metadata }
      return
    }
    try {
      const tree = await getCostCenterTreeById(parsed.data.id)
      if (!tree) {
        ctx.status = 404
        ctx.body = { reason: 'Cost center not found', ...metadata }
        return
      }
      ctx.body = {
        content: CostCenterTreeSchema.parse(tree),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
