import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import { findKvvAreaCodesByResponsibles } from '../adapters/kvv-area-adapter'

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
   *                     type: object
   *                     properties:
   *                       code:
   *                         type: string
   *                     required:
   *                       - code
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
}
