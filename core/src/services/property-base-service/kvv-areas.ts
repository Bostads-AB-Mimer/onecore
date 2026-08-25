import assert from 'node:assert'
import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import { requireRole } from '../../middlewares/keycloak-auth'
import { getUsersByRole } from '../auth-service/keycloak-admin-adapter'
import { PROPERTY_AREA_WRITE_ROLE, PROPERTY_MANAGER_ROLE } from './constants'
import { resolvePropertyManagers, toUserSummary } from './keycloak-users'
import {
  KvvAreaWithResponsibleSchema,
  PatchedKvvAreaSchema,
  PatchKvvAreaResponsibleBodySchema,
} from './schemas'

const QuerySchema = z.object({
  responsibleUserId: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
})

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Kvv Areas
 *     description: Operations related to OneCore kvv-areas (förvaltningsområden)
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /kvv-areas:
   *   get:
   *     summary: List kvv-areas (förvaltningsområden) with cost center and responsible
   *     description: |
   *       Returns every kvv-area with its cost center (distrikt) and the
   *       responsible kvartersvärd hydrated from Keycloak (`null` if unset or
   *       if Keycloak is unreachable). Repeat `responsibleUserId` to restrict
   *       the list to areas whose responsible is one of the given Keycloak user
   *       ids; omit it to list all areas.
   *     tags:
   *       - Kvv Areas
   *     parameters:
   *       - in: query
   *         name: responsibleUserId
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Keycloak user ids (repeatable). Omit to list all areas.
   *     responses:
   *       200:
   *         description: List of kvv-areas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KvvAreaWithResponsible'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/kvv-areas', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['responsibleUserId'])
    const parsed = QuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameters', ...metadata }
      return
    }
    const result = await propertyBaseAdapter.listKvvAreas({
      responsibleUserIds: parsed.data.responsibleUserId,
    })
    if (!result.ok) {
      logger.error({ err: result.err }, 'kvv-areas.get')
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }

    // Bulk shape: one role fetch resolves all ~33 areas. This only matches
    // users who *currently hold* the property-manager role, whereas
    // GET /properties/:code/kvv-area resolves the assigned id directly (one
    // cheap call on Odoo's per-errand path). Intentional — this endpoint
    // answers "who are the current managers".
    //
    // In practice `responsible` is null for a large share of areas (15 of 33 in
    // TEST_21_DB): every area has a stored id, but many point at users Keycloak
    // no longer knows — stale ids from the original import, not role removal.
    // Those resolve to null on *both* paths. Consumers must treat null as
    // "cannot name the steward", not as "area has no steward"; cleaning the
    // stored ids is a per-environment data task.
    const resolveUser = await resolvePropertyManagers(
      result.data.some((a) => a.responsibleKeycloakUserId !== null)
    )

    ctx.body = {
      content: z.array(KvvAreaWithResponsibleSchema).parse(
        result.data.map(({ responsibleKeycloakUserId, ...area }) => ({
          ...area,
          responsible: resolveUser(responsibleKeycloakUserId),
        }))
      ),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /kvv-areas/{id}/responsible:
   *   patch:
   *     summary: Update the responsible kvartersvärd for a KVV area
   *     description: |
   *       Requires the `property-areas:write` realm role. The target user (by
   *       `keycloakUserId`) must hold the `property-manager` role in Keycloak;
   *       a 400 is returned otherwise. On success the updated area is returned
   *       with the new responsible user hydrated.
   *     tags:
   *       - Kvv Areas
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [keycloakUserId]
   *             properties:
   *               keycloakUserId:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       200:
   *         description: Updated KVV area with hydrated responsible user
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/PatchedKvvArea'
   *       400:
   *         description: Invalid body or target user is not a property manager
   *       403:
   *         description: Caller lacks the `property-areas:write` role
   *       404:
   *         description: KVV area not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '(.*)/kvv-areas/:id/responsible',
    requireRole(PROPERTY_AREA_WRITE_ROLE),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { id } = ctx.params

      const parsedBody = PatchKvvAreaResponsibleBodySchema.safeParse(
        ctx.request.body
      )
      if (!parsedBody.success) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid request body',
          errors: parsedBody.error.issues,
          ...metadata,
        }
        return
      }
      const { keycloakUserId } = parsedBody.data

      const propertyManagers = await getUsersByRole(PROPERTY_MANAGER_ROLE)
      if (!propertyManagers.ok) {
        logger.error(
          { err: propertyManagers.err },
          'kvv-areas.route: keycloak getUsersByRole failed — cannot validate target user'
        )
        ctx.status = 502
        ctx.body = {
          reason: 'Could not verify target user against Keycloak',
          ...metadata,
        }
        return
      }

      const targetUser = propertyManagers.data.find(
        (u) => u.id === keycloakUserId
      )
      if (!targetUser) {
        ctx.status = 400
        ctx.body = {
          reason: 'Target user is not a property manager',
          ...metadata,
        }
        return
      }

      // requireRole runs after requireAuth, which guarantees ctx.state.user.id
      assert(
        ctx.state.user?.id,
        'requireRole middleware must run before this route — ctx.state.user.id is not set'
      )
      const callerKeycloakId: string = ctx.state.user.id

      const result = await propertyBaseAdapter.updateKvvAreaResponsible(id, {
        keycloakUserId,
        updatedBy: callerKeycloakId,
      })

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'KVV area not found', ...metadata }
          return
        }
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: PatchedKvvAreaSchema.parse({
          id: result.data.id,
          code: result.data.code,
          name: result.data.name ?? null,
          responsible: toUserSummary(targetUser),
        }),
        ...metadata,
      }
    }
  )
}
