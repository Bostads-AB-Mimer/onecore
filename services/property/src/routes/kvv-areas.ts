import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  findKvvAreaCodesByResponsibles,
  updateKvvAreaResponsible,
} from '../adapters/kvv-area-adapter'
import { parseRequest } from '../middleware/parse-request'
import { KvvAreaSchema, PatchKvvAreaResponsibleSchema } from '../types/kvv-area'

const QuerySchema = z.object({
  responsibleUserId: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
})

const PathParamsSchema = z.object({ id: z.string().uuid() })

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
   */
  router.get('(.*)/kvv-areas', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['responsibleUserId'])
    const parsed = QuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameters', ...metadata }
      return
    }
    try {
      const codes = await findKvvAreaCodesByResponsibles(
        parsed.data.responsibleUserId ?? []
      )
      ctx.body = { content: codes.map((code) => ({ code })), ...metadata }
    } catch (err) {
      logger.error({ err }, 'kvv-areas.get')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /kvv-areas/{id}/responsible:
   *   patch:
   *     summary: Update the responsible kvartersvärd for a KVV area
   *     description: |
   *       Sets `responsible_keycloak_user_id` for the given KVV area and stamps
   *       `updated_by`. Target-user role validation happens in core; this
   *       endpoint trusts the caller.
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
   *             required: [keycloakUserId, updatedBy]
   *             properties:
   *               keycloakUserId:
   *                 type: string
   *                 format: uuid
   *               updatedBy:
   *                 type: string
   *     responses:
   *       200:
   *         description: Updated KVV area
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KvvArea'
   *       400:
   *         description: Invalid id or body
   *       404:
   *         description: KVV area not found
   *       500:
   *         description: Internal server error
   */
  router.patch(
    '(.*)/kvv-areas/:id/responsible',
    parseRequest({ body: PatchKvvAreaResponsibleSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const params = PathParamsSchema.safeParse(ctx.params)
      if (!params.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid id', ...metadata }
        return
      }

      const { keycloakUserId, updatedBy } = ctx.request.parsedBody

      try {
        const result = await updateKvvAreaResponsible(params.data.id, {
          responsibleKeycloakUserId: keycloakUserId,
          updatedBy,
        })

        if (!result.ok) {
          ctx.status = 404
          ctx.body = { reason: 'KVV area not found', ...metadata }
          return
        }

        ctx.body = {
          content: KvvAreaSchema.parse(result.data),
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage = err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )
}
