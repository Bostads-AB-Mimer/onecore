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

// Display identity for logged phone calls; mirrors SMS_SENDER in the
// infobip sms routes (dispatch.fromAddress is NOT NULL).
const CALL_FROM_ADDRESS = 'Mimer'
// Calls are made and reported by employees working in Odoo — there is no
// telephony provider integration behind this log entry.
const CALL_PROVIDER = 'odoo'

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

  router.post(
    '/communication-log/calls',
    {
      summary: 'Log a phone call triggered from an Odoo errand',
      description:
        'Persist a phone call in the communication log. Called by Odoo (via ' +
        'core) when an employee triggers a call from an errand. The call has ' +
        'already happened, so the entry is logged as a completed fact with ' +
        "recipient status 'sent'. triggeredByUser comes from the request " +
        'body since Odoo authenticates with a service account. The errand ' +
        'code (workOrderCode) lets the frontend link the entry to the errand ' +
        'in Odoo.',
      tags: ['Communication log'],
      body: communication.LogCallParamsSchema,
      response: {
        200: LogOutboundResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        // The okapi body schema is documentation/typing only — validate here.
        const params = communication.LogCallParamsSchema.parse(ctx.request.body)

        const result = await logOutboundDispatch({
          channel: 'call',
          fromAddress: CALL_FROM_ADDRESS,
          body: `Telefonsamtal gällande ärende ${params.workOrderCode}`,
          messageType: 'work_order_tenant_call',
          provider: CALL_PROVIDER,
          triggeredByUser: params.triggeredByUser,
          workOrderCode: params.workOrderCode,
          recipients: [
            {
              contactCode: params.contactCode,
              toAddress: params.phoneNumber,
              status: 'sent',
            },
          ],
        })

        ctx.status = 200
        ctx.body = result
      } catch (error) {
        if (error instanceof z.ZodError) {
          ctx.status = 400
          ctx.body = {
            error: `Invalid call log payload: ${error.issues
              .map((issue) => issue.path.join('.'))
              .join(', ')}`,
          }
          return
        }
        logger.error({ err: error }, 'failed to log call')
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
