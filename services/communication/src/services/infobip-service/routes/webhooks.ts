import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import crypto from 'node:crypto'
import { z } from 'zod'

import Config from '../../../common/config'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { updateRecipientStatusByExternalId } from '../../communication-log-service/adapters/db'
import {
  mapInfobipStatus,
  InfobipStatusSchema,
  InfobipErrorSchema,
} from '../adapters/delivery-report'

// Infobip delivery-report payload (push to notifyUrl). The same `results[]`
// envelope is used for both SMS and email; `messageId` matches what we stored
// as `externalMessageId` at send time. The status/error field schemas live with
// the mapper (single source of truth). Service-local (Infobip-specific, not
// consumed by core) so it lives here rather than in @onecore/types.
const InfobipDeliveryReportSchema = z.object({
  results: z.array(
    z.object({
      messageId: z.string(),
      status: InfobipStatusSchema,
      error: InfobipErrorSchema.optional(),
    })
  ),
})

type InfobipDeliveryReport = z.infer<typeof InfobipDeliveryReportSchema>

// Constant-time string compare that never short-circuits on length.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Authenticate a delivery-report callback. Two providers, two mechanisms:
 *  - Email arrives via the Infobip account Subscription, which sends HTTP Basic
 *    (webhookUsername/webhookPassword).
 *  - SMS arrives via a per-message webhook on the Tele2 send, which has no
 *    header slot, so the secret rides in the URL (?token=webhookToken).
 * The request is accepted if EITHER matches. Enforced only when at least one
 * credential is configured (mirrors the keys-service webhook: dev/local with
 * empty config skips the check). Runs before body parsing so unauthenticated
 * callers can't probe the schema via 400s.
 */
const verifyWebhookAuth: KoaRouter.Middleware = (ctx, next) => {
  const { webhookUsername, webhookPassword, webhookToken } = Config.infobip
  const basicConfigured = Boolean(webhookUsername && webhookPassword)

  if (!basicConfigured && !webhookToken) {
    return next()
  }

  // SMS path: ?token= in the URL.
  if (webhookToken) {
    const provided = Array.isArray(ctx.query.token)
      ? ctx.query.token[0]
      : ctx.query.token
    if (provided && safeEqual(provided, webhookToken)) {
      return next()
    }
  }

  // Email path: Basic auth header.
  if (basicConfigured) {
    const expected =
      'Basic ' +
      Buffer.from(`${webhookUsername}:${webhookPassword}`).toString('base64')
    if (safeEqual(ctx.get('authorization'), expected)) {
      return next()
    }
  }

  logger.warn(
    { providedAuth: ctx.get('authorization') ? 'provided' : 'missing' },
    'webhooks.infobip: invalid auth'
  )
  ctx.status = 401
  ctx.body = { reason: 'Unauthorized', ...generateRouteMetadata(ctx) }
  return
}

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /webhooks/infobip:
   *   post:
   *     summary: Webhook endpoint for Infobip SMS/email delivery reports
   *     description: >
   *       Consumes Infobip delivery reports and updates the matching
   *       message_recipient row's status/error by externalMessageId.
   *       Accepts either authentication mechanism: HTTP Basic auth (email, via
   *       the Infobip account Subscription) or a secret `token` query parameter
   *       (SMS, via the per-message delivery webhook, which has no header slot).
   *     tags: [Webhooks]
   *     security:
   *       - basicAuth: []
   *       - {}
   *     parameters:
   *       - in: query
   *         name: token
   *         required: false
   *         schema:
   *           type: string
   *         description: Shared secret for the SMS per-message webhook (alternative to Basic auth)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               results:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Delivery report processed (acknowledged even on 0 matches)
   *       401:
   *         description: Missing or invalid credentials (Basic auth or token)
   */
  router.post(
    '(.*)/webhooks/infobip',
    verifyWebhookAuth,
    parseRequestBody(InfobipDeliveryReportSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const { results } = ctx.request.body as InfobipDeliveryReport

        // Results are independent rows — update them concurrently (knex caps
        // pool concurrency, so a large email batch won't exhaust connections).
        await Promise.all(
          results.map((result) => {
            const status = mapInfobipStatus(result.status, result.error)
            // null = non-terminal (PENDING): leave the row as-is.
            if (status === null) return undefined

            // Only carry the provider error onto failures/bounces; a delivered
            // report's error is "OK"/"No Error" which we don't want to persist.
            const errorText =
              status === 'delivered' ? undefined : result.error?.description

            return updateRecipientStatusByExternalId(
              result.messageId,
              status,
              errorText
            )
          })
        )

        ctx.status = 200
        ctx.body = { ...metadata }
      } catch (err) {
        logger.error({ err }, 'webhooks.infobip')
        // 500 lets Infobip retry the batch — a transient DB outage shouldn't
        // silently drop a delivery report.
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )
}
