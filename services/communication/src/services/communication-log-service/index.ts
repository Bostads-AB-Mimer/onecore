import { OkapiRouter } from 'koa-okapi-router'
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  getCustomerMessages,
  getDispatchById,
  logOutboundDispatch,
} from './adapters/db'

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

  router.get(
    '/communication-log/dispatches/:id',
    {
      summary: 'Get a dispatch and its recipients by dispatch id',
      description:
        'Returns the dispatch row plus all message_recipient rows that ' +
        'belong to it. 404 when no dispatch with that id exists.',
      tags: ['Communication log'],
      params: {
        id: { description: 'Dispatch id (UUID)', schema: z.string().uuid() },
      },
      response: {
        200: communication.DispatchWithRecipientsSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const result = await getDispatchById(ctx.params.id)
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Dispatch not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        logger.error({ err: error }, 'failed to get dispatch')
        ctx.status = 500
        ctx.body = {
          error: error instanceof Error ? error.message : 'unknown error',
        }
      }
    }
  )

  router.get(
    '/communication-log/customers/:contactCode/messages',
    {
      summary: 'Get the communication timeline for a customer',
      description:
        'Returns every message_recipient row owned by the given contactCode, ' +
        'each paired with its parent dispatch. Newest first. Empty array ' +
        'when the customer has no logged communications.',
      tags: ['Communication log'],
      params: {
        contactCode: { description: 'Customer id', schema: z.string().min(1) },
      },
      response: {
        200: z.array(communication.CustomerMessageSchema),
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const result = await getCustomerMessages(ctx.params.contactCode)
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        logger.error({ err: error }, 'failed to get customer messages')
        ctx.status = 500
        ctx.body = {
          error: error instanceof Error ? error.message : 'unknown error',
        }
      }
    }
  )
}
