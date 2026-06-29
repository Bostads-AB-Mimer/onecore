import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { z } from 'zod'

import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { updateRecipientStatusByExternalId } from '../../communication-log-service/adapters/db'
import {
  mapInfobipStatus,
  InfobipStatusSchema,
  InfobipErrorSchema,
} from '../adapters/delivery-report'

// Infobip delivery-report payload. The same `results[]` envelope is used for
// both SMS and email; `messageId` matches what we stored as `externalMessageId`
// at send time. The status/error field schemas live with the mapper (single
// source of truth). Service-local (Infobip-specific, not consumed by core's
// generated types) so it lives here rather than in @onecore/types.
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
 * Apply a parsed Infobip delivery report to message_recipient rows. Results are
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

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /delivery-report:
   *   post:
   *     summary: Internal endpoint for Infobip delivery reports forwarded by core
   *     description: >
   *       Internal (not publicly exposed). All Infobip delivery reports — email
   *       (Keycloak) and SMS (token) — are authenticated by core and forwarded
   *       here for processing. Maps the report and updates the matching
   *       message_recipient row by externalMessageId.
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Delivery report processed (acknowledged even on 0 matches)
   *       500:
   *         description: Internal server error
   */
  router.post(
    '(.*)/delivery-report',
    parseRequestBody(InfobipDeliveryReportSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        await processDeliveryReport(ctx.request.body as InfobipDeliveryReport)
        ctx.status = 200
        ctx.body = { ...metadata }
      } catch (err) {
        logger.error({ err }, 'webhooks.delivery-report')
        // 500 lets core (and the provider) retry — a transient DB outage
        // shouldn't silently drop a delivery report.
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )
}
