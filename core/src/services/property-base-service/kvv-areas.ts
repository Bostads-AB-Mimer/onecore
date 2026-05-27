import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import { requireRole } from '../../middlewares/keycloak-auth'
import { getUsersByRole } from '../auth-service/keycloak-admin-adapter'
import { PROPERTY_AREA_WRITE_ROLE, PROPERTY_MANAGER_ROLE } from './constants'
import {
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
   *     summary: List kvv-area codes filtered by responsible Keycloak users
   *     description: |
   *       Returns the codes of kvv-areas (förvaltningsområden) whose
   *       responsibleKeycloakUserId is one of the provided user ids. Repeat the
   *       responsibleUserId query param for each user id. Returns an empty list
   *       if the param is omitted.
   *     tags:
   *       - Kvv Areas
   *     parameters:
   *       - in: query
   *         name: responsibleUserId
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Keycloak user ids (repeatable)
   *     responses:
   *       200:
   *         description: List of kvv-area codes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KvvAreaSummary'
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
    const result = await propertyBaseAdapter.findKvvAreaCodesByResponsibles(
      parsed.data.responsibleUserId ?? []
    )
    if (!result.ok) {
      logger.error({ err: result.err }, 'kvv-areas.get')
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }
    ctx.body = {
      content: result.data.map((code) => ({ code })),
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

      const callerKeycloakId = ctx.state.user?.id
      if (!callerKeycloakId) {
        ctx.status = 401
        ctx.body = { reason: 'Missing caller identity', ...metadata }
        return
      }

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
          responsible: {
            id: targetUser.id,
            username: targetUser.username,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            email: targetUser.email,
            mobilePhone: targetUser.attributes?.mobilePhone?.[0],
            employeeId: targetUser.attributes?.employeeId?.[0],
          },
        }),
        ...metadata,
      }
    }
  )
}
