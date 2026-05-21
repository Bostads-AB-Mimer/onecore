import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import {
  getUsersByRole,
  KeycloakUser,
} from '../auth-service/keycloak-admin-adapter'
import {
  CostCenterSummarySchema,
  CostCenterTreeSchema,
  type CostCenterTree,
} from './schemas'

const PROPERTY_MANAGER_ROLE = 'property-manager'

function toUserSummary(user: KeycloakUser) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  }
}

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Cost Centers
 *     description: Cost center (förvaltningsområde) tree
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /cost-centers:
   *   get:
   *     summary: List all cost centers
   *     description: Returns all OneCore cost centers in a minimal shape suitable for select lists.
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/cost-centers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await propertyBaseAdapter.listCostCenters()
    if (!result.ok) {
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }
    ctx.body = {
      content: result.data.map((r) => CostCenterSummarySchema.parse(r)),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /cost-centers/{id}/tree:
   *   get:
   *     summary: Get a cost center management tree
   *     description: |
   *       Returns the cost center with KVV areas, properties (addresses + aggregates)
   *       and Keycloak-expanded lead, deputy and responsible users. If Keycloak is
   *       unreachable, the tree is returned with user fields set to null.
   *     tags:
   *       - Cost Centers
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/cost-centers/:id/tree', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id

    const treeResult = await propertyBaseAdapter.getCostCenterTreeById(id)
    if (!treeResult.ok) {
      if (treeResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Cost center not found', ...metadata }
        return
      }
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }

    const raw = treeResult.data

    const usersResult = await getUsersByRole(PROPERTY_MANAGER_ROLE)
    const userById = new Map<string, KeycloakUser>()
    if (usersResult.ok) {
      for (const u of usersResult.data) userById.set(u.id, u)
    } else {
      logger.error(
        { err: usersResult.err },
        'cost-centers.route: keycloak getUsersByRole failed — returning tree with null users'
      )
    }

    const lookup = (userId: string | null) => {
      if (!userId) return null
      const u = userById.get(userId)
      return u ? toUserSummary(u) : null
    }

    const composed: CostCenterTree = {
      id: raw.id,
      code: raw.code,
      name: raw.name,
      lead: lookup(raw.leadKeycloakUserId),
      deputy: lookup(raw.deputyKeycloakUserId),
      kvvAreas: raw.kvvAreas.map((area) => ({
        id: area.id,
        code: area.code,
        name: area.name,
        responsible: lookup(area.responsibleKeycloakUserId),
        properties: area.properties,
      })),
    }

    ctx.body = {
      content: CostCenterTreeSchema.parse(composed),
      ...metadata,
    }
  })
}
