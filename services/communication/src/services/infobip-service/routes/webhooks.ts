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

/**
 * Apply a parsed Infobip delivery report to message_recipient rows. Shared by
 * both entry points: the public token webhook (SMS, Tele2) and the internal
 * /delivery-report endpoint that core forwards email reports to. Results are
 * independent rows, so update them concurrently (knex caps pool concurrency).
 */
async function processDeliveryReport(
  report: InfobipDeliveryReport
): Promise<void> {
  await Promise.all(
    report.results.map((result) => {
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
}

// Constant-time string compare that never short-circuits on length.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Authenticate the public SMS delivery-report webhook. SMS arrives via a Tele2
 * per-message webhook, which has no header slot, so the secret rides in the URL
 * (?token=webhookToken). Enforced only when webhookToken is configured (dev/local
 * skips). Email no longer hits this service — it comes through core (Keycloak)
 * to the internal /delivery-report endpoint.
 */
const verifyWebhookToken: KoaRouter.Middleware = (ctx, next) => {
  const { webhookToken } = Config.infobip
  if (!webhookToken) {
    return next()
  }

  const provided = Array.isArray(ctx.query.token)
    ? ctx.query.token[0]
    : ctx.query.token

  if (provided && safeEqual(provided, webhookToken)) {
    return next()
  }

  logger.warn(
    { providedToken: provided ? 'provided' : 'missing' },
    'webhooks.infobip: invalid token'
  )
  ctx.status = 401
  ctx.body = { reason: 'Unauthorized', ...generateRouteMetadata(ctx) }
  return
}

// Shared handler: body is already validated by parseRequestBody.
const handleDeliveryReport: KoaRouter.Middleware = async (ctx) => {
  const metadata = generateRouteMetadata(ctx)
  try {
    await processDeliveryReport(ctx.request.body as InfobipDeliveryReport)
    ctx.status = 200
    ctx.body = { ...metadata }
  } catch (err) {
    logger.error({ err }, 'webhooks.infobip')
    // 500 lets the caller retry — a transient DB outage shouldn't silently
    // drop a delivery report.
    ctx.status = 500
    ctx.body = { reason: 'Internal server error', ...metadata }
  }
}

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /webhooks/infobip:
   *   post:
   *     summary: Public webhook for Infobip SMS delivery reports (Tele2)
   *     description: >
   *       Consumes Infobip SMS delivery reports (Tele2 per-message webhook) and
   *       updates the matching message_recipient row's status/error by
   *       externalMessageId. Authenticated with a secret `token` query param
   *       (per-message webhooks have no header slot). Email reports do NOT hit
   *       this endpoint — they come through core (Keycloak) to /delivery-report.
   *     tags: [Webhooks]
   *     parameters:
   *       - in: query
   *         name: token
   *         required: true
   *         schema:
   *           type: string
   *         description: Shared secret for the SMS per-message webhook
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Delivery report processed (acknowledged even on 0 matches)
   *       401:
   *         description: Missing or invalid token
   */
  router.post(
    '(.*)/webhooks/infobip',
    verifyWebhookToken,
    parseRequestBody(InfobipDeliveryReportSchema),
    handleDeliveryReport
  )

  /**
   * @swagger
   * /delivery-report:
   *   post:
   *     summary: Internal endpoint for Infobip delivery reports forwarded by core
   *     description: >
   *       Internal (not publicly exposed). Core authenticates Infobip's email
   *       webhook via Keycloak and forwards the report here for the same
   *       processing as /webhooks/infobip.
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Delivery report processed
   */
  router.post(
    '(.*)/delivery-report',
    parseRequestBody(InfobipDeliveryReportSchema),
    handleDeliveryReport
  )
}
