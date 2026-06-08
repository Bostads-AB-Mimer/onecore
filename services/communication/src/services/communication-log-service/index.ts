import { OkapiRouter } from 'koa-okapi-router'
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import { logOutboundDispatch } from './adapters/db-adapter'

const LogOutboundResponseSchema = z.object({
  dispatchId: z.string().uuid(),
})

const ErrorResponseSchema = z.object({
  error: z.string(),
})

export const routes = (router: OkapiRouter) => {
  router.post(
    '/communication-log/outbound',
    {
      summary: 'Log an outbound communication event',
      description:
        'Persist a dispatch row plus one message_recipient row per recipient. ' +
        'Provider-agnostic: callers pass the provider name and (if known) ' +
        'per-recipient externalMessageId for later delivery-webhook matching. ' +
        'Called by send routes after the provider has accepted the send.',
      tags: ['Communication log'],
      body: communication.LogOutboundParamsSchema,
      response: {
        200: LogOutboundResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const result = await logOutboundDispatch(ctx.request.body)
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        logger.error({ err: error }, 'failed to log outbound dispatch')
        ctx.status = 500
        ctx.body = {
          error: error instanceof Error ? error.message : 'unknown error',
        }
      }
    }
  )
}
