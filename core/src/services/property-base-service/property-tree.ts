import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import { PROPERTY_MANAGER_ROLE } from './constants'
import { getCachedUsersByRole, toUserSummary } from './keycloak-users'
import {
  parseQuery,
  parseUpstream,
  replyError,
} from '../../utils/route-helpers'
import { PropertyGroupingSchema, PropertyTreeSchema } from './schemas'

const GetPropertyTreeQuerySchema = z.object({
  groupBy: PropertyGroupingSchema,
  rootId: z.string().min(1),
  // Forwarded verbatim; 'false' skips the rental-object leaves.
  includeObjects: z.enum(['true', 'false']).optional(),
})

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property tree
 *     description: Property hierarchy organised by cost center, marknadsområde or företag
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /property-tree:
   *   get:
   *     summary: Get the property tree for one grouping root
   *     description: |
   *       Properties with their buildings, trapphus, parkeringsområden and
   *       per-type counts, beneath one grouping root. `groups` carries the
   *       intermediate level when the grouping has one (KVV-areas for
   *       costCenter); otherwise properties hang directly off the root.
   *
   *       Only operating-company stock is returned — Xpand moves sold
   *       properties to a pseudo-company rather than delete-marking them.
   *     tags:
   *       - Property tree
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
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/PropertyTree'
   *       400:
   *         description: Invalid query parameters
   *       404:
   *         description: Root not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/property-tree', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const query = parseQuery(ctx, GetPropertyTreeQuerySchema, metadata)
    if (!query) return

    // Only the cost-center grouping has responsible users; fetch them in
    // parallel with the tree so Keycloak never sits on the critical path.
    const [result, responsibleUsers] = await Promise.all([
      propertyBaseAdapter.getPropertyTree(query),
      query.groupBy === 'costCenter'
        ? getCachedUsersByRole(PROPERTY_MANAGER_ROLE)
        : Promise.resolve(null),
    ])
    if (!result.ok) {
      return replyError(ctx, result.err, metadata, {
        notFound: 'Root not found',
      })
    }

    // Degrades to responsible: null below — log it, or the blip is invisible.
    if (responsibleUsers && !responsibleUsers.ok) {
      logger.error(
        { err: responsibleUsers.err, role: PROPERTY_MANAGER_ROLE },
        'property-tree: responsible users lookup failed'
      )
    }
    const byId = new Map(
      responsibleUsers?.ok
        ? responsibleUsers.data.map((u) => [u.id, u] as const)
        : []
    )
    const composed = {
      ...result.data,
      groups: result.data.groups.map((group) => {
        const user = group.responsibleKeycloakUserId
          ? byId.get(group.responsibleKeycloakUserId)
          : undefined
        return {
          id: group.id,
          code: group.code,
          name: group.name,
          responsible: user ? toUserSummary(user) : null,
          properties: group.properties,
        }
      }),
    }

    const content = parseUpstream(ctx, PropertyTreeSchema, composed, metadata)
    if (!content) return
    ctx.body = { content, ...metadata }
  })
}
