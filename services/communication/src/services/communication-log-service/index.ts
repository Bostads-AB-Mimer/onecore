import { OkapiRouter } from 'koa-okapi-router'
import { communication, paginatedResponseSchema } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  cancelScheduledRecipients,
  getCustomerMessages,
  getDispatchById,
  getDispatchRecipients,
  logOutboundDispatch,
  searchDispatches,
  updateDispatchSendAt,
} from './adapters/db'
import {
  cancelScheduledBulk,
  rescheduleScheduledBulk,
  ScheduledBulkConflictError,
} from '../infobip-service/adapters/schedule-adapter'
import {
  evaluateSendAt,
  MAX_SCHEDULE_DAYS_AHEAD,
} from '../infobip-service/schedule'

const LogOutboundResponseSchema = z.object({
  dispatchId: z.string().uuid(),
})

const ErrorResponseSchema = z.object({
  error: z.string(),
  // Provider detail for 409s (what Infobip actually said) — internal service,
  // so surfacing it aids debugging without leaking to end users via core.
  message: z.string().optional(),
})

const RETRY_DELAY_MS = 250

// Retry a transient failure a few times before giving up. Used where an
// Infobip mutation has already succeeded and the follow-up DB write is the
// only thing standing between us and a permanently divergent state.
async function withRetries<T>(
  attempts: number,
  fn: () => Promise<T>
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
  throw lastError
}

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

  router.post(
    '/communication-log/dispatches/:id/cancel',
    {
      summary: 'Cancel a scheduled dispatch',
      description:
        'Cancels the Infobip scheduled bulk (bulkId = dispatch id) and marks ' +
        "every still-'scheduled' recipient as 'cancelled'. Idempotent: a " +
        'dispatch whose recipients are already cancelled returns 200 without ' +
        'calling Infobip. 409 when Infobip refuses (bulk already sent or ' +
        'processing) — recipient statuses are then left for delivery reports ' +
        'to finalize.',
      tags: ['Communication log'],
      params: {
        id: { description: 'Dispatch id (UUID)', schema: z.string().uuid() },
      },
      response: {
        200: communication.CancelDispatchResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const dispatch = await getDispatchById(ctx.params.id)
        if (!dispatch) {
          ctx.status = 404
          ctx.body = { error: 'Dispatch not found' }
          return
        }

        const statuses = dispatch.recipients.map((r) => r.status)
        if (statuses.length > 0 && statuses.every((s) => s === 'cancelled')) {
          ctx.status = 200
          ctx.body = { dispatchId: ctx.params.id, cancelledRecipients: 0 }
          return
        }
        if (!statuses.includes('scheduled')) {
          ctx.status = 400
          ctx.body = { error: 'NOT_SCHEDULED' }
          return
        }

        await cancelScheduledBulk(dispatch.dispatch.channel, ctx.params.id)

        // Infobip has cancelled the bulk — from here the DB write must land,
        // or the rows stay 'scheduled' forever for a bulk that will never
        // send (nothing else writes 'cancelled'). Retry before failing.
        try {
          const { updatedCount } = await withRetries(2, () =>
            cancelScheduledRecipients(ctx.params.id)
          )
          ctx.status = 200
          ctx.body = {
            dispatchId: ctx.params.id,
            cancelledRecipients: updatedCount,
          }
        } catch (error) {
          logger.error(
            { err: error, dispatchId: ctx.params.id },
            "bulk cancelled at Infobip but recipients could not be marked 'cancelled' — log still shows scheduled"
          )
          ctx.status = 500
          ctx.body = { error: 'CANCEL_STATUS_UPDATE_FAILED' }
        }
      } catch (error) {
        if (error instanceof ScheduledBulkConflictError) {
          ctx.status = 409
          ctx.body = { error: 'ALREADY_PROCESSED', message: error.message }
          return
        }
        logger.error({ err: error }, 'failed to cancel scheduled dispatch')
        ctx.status = 500
        ctx.body = { error: 'CANCEL_FAILED' }
      }
    }
  )

  router.post(
    '/communication-log/dispatches/:id/reschedule',
    {
      summary: 'Move a scheduled dispatch to a later send time',
      description:
        'Reschedules the Infobip bulk (bulkId = dispatch id) and updates the ' +
        "dispatch's sendAt. The new time must be LATER than the currently " +
        'scheduled time — Infobip can postpone a queued bulk but silently ' +
        'ignores moves to an earlier time — and within the channel cap ' +
        '(sms 90 days, email 5 days). 409 when Infobip refuses (bulk ' +
        'already sent or processing).',
      tags: ['Communication log'],
      params: {
        id: { description: 'Dispatch id (UUID)', schema: z.string().uuid() },
      },
      body: z.object({
        // ISO 8601 instant with offset/Z.
        sendAt: z.string().datetime({ offset: true }),
      }),
      response: {
        200: communication.RescheduleDispatchResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const dispatch = await getDispatchById(ctx.params.id)
        if (!dispatch) {
          ctx.status = 404
          ctx.body = { error: 'Dispatch not found' }
          return
        }
        if (!dispatch.recipients.some((r) => r.status === 'scheduled')) {
          ctx.status = 400
          ctx.body = { error: 'NOT_SCHEDULED' }
          return
        }

        const evaluation = evaluateSendAt(
          ctx.request.body.sendAt,
          MAX_SCHEDULE_DAYS_AHEAD[dispatch.dispatch.channel]
        )
        // 'immediate' (within the grace window) is not a valid reschedule
        // target — the point of rescheduling is a concrete future time.
        if (evaluation.kind === 'invalid') {
          ctx.status = 400
          ctx.body = { error: evaluation.code }
          return
        }
        if (evaluation.kind !== 'scheduled') {
          ctx.status = 400
          ctx.body = { error: 'SEND_AT_TOO_SOON' }
          return
        }
        // Infobip can postpone a queued bulk but silently ignores moves to an
        // earlier time (verified live 2026-07-27) — only allow later times.
        if (evaluation.sendAt <= new Date(dispatch.dispatch.sendAt)) {
          ctx.status = 400
          ctx.body = { error: 'SEND_AT_NOT_LATER' }
          return
        }

        await rescheduleScheduledBulk(
          dispatch.dispatch.channel,
          ctx.params.id,
          evaluation.sendAt
        )

        // Infobip has moved the bulk — from here the DB write must land, or
        // the log keeps showing the old time for a send that will fire at
        // the new one. Retry before failing. Mirrors the cancel route.
        try {
          await withRetries(2, () =>
            updateDispatchSendAt(ctx.params.id, evaluation.sendAt)
          )
          ctx.status = 200
          ctx.body = {
            dispatchId: ctx.params.id,
            sendAt: evaluation.sendAt.toISOString(),
          }
        } catch (error) {
          logger.error(
            { err: error, dispatchId: ctx.params.id },
            'bulk rescheduled at Infobip but dispatch sendAt could not be updated — log still shows the old time'
          )
          ctx.status = 500
          ctx.body = { error: 'RESCHEDULE_STATUS_UPDATE_FAILED' }
        }
      } catch (error) {
        if (error instanceof ScheduledBulkConflictError) {
          ctx.status = 409
          ctx.body = { error: 'ALREADY_PROCESSED', message: error.message }
          return
        }
        logger.error({ err: error }, 'failed to reschedule dispatch')
        ctx.status = 500
        ctx.body = { error: 'RESCHEDULE_FAILED' }
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

  router.get(
    '/communication-log/dispatches',
    {
      summary: 'Search and list dispatches',
      description:
        'Paginated dispatch search. Filters: q (subject/body LIKE), channel, ' +
        'messageType, derived status, source (manual/automatic), sendAt range, ' +
        'contactCode, minRecipients, and audience codes (district/building/' +
        'area). Newest first by default.',
      tags: ['Communication log'],
      query: {
        q: {
          description: 'Content search (subject/body)',
          schema: z.string().optional(),
        },
        channel: {
          description: "'sms' | 'email' (repeatable)",
          schema: z.optional(z.array(z.string())),
        },
        messageType: {
          description: 'Category (repeatable)',
          schema: z.optional(z.array(z.string())),
        },
        status: {
          description: 'Derived status (repeatable)',
          schema: z.optional(z.array(z.string())),
        },
        source: {
          description: 'manual | automatic',
          schema: z.optional(z.enum(['manual', 'automatic'])),
        },
        sendAtFrom: {
          description: 'ISO date lower bound',
          schema: z.string().optional(),
        },
        sendAtTo: {
          description: 'ISO date upper bound',
          schema: z.string().optional(),
        },
        contactCode: {
          description: 'Dispatches that reached this contact',
          schema: z.string().optional(),
        },
        minRecipients: {
          description: 'Minimum recipient count',
          schema: z.optional(z.number()),
        },
        audienceDistrictNames: {
          description: 'Audience district (repeatable)',
          schema: z.optional(z.array(z.string())),
        },
        audienceBuildingCodes: {
          description: 'Audience building code (repeatable)',
          schema: z.optional(z.array(z.string())),
        },
        audienceAreaCodes: {
          description: 'Audience area code (repeatable)',
          schema: z.optional(z.array(z.string())),
        },
        sortBy: {
          description: 'sendAt | recipientCount | createdAt',
          schema: z.optional(z.enum(['sendAt', 'recipientCount', 'createdAt'])),
        },
        sortOrder: {
          description: 'asc | desc',
          schema: z.optional(z.enum(['asc', 'desc'])),
        },
        page: { description: 'Page (1-based)', schema: z.optional(z.number()) },
        limit: { description: 'Page size', schema: z.optional(z.number()) },
      },
      response: {
        200: paginatedResponseSchema(communication.DispatchListItemSchema),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.DispatchSearchQueryParamsSchema.safeParse(
        ctx.query
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid query parameters',
          message: parsed.error.message,
        }
        return
      }
      try {
        ctx.status = 200
        ctx.body = await searchDispatches(parsed.data, ctx)
      } catch (error) {
        logger.error({ err: error }, 'failed to search dispatches')
        ctx.status = 500
        ctx.body = {
          error: error instanceof Error ? error.message : 'unknown error',
        }
      }
    }
  )

  router.get(
    '/communication-log/dispatches/:id/recipients',
    {
      summary: 'Paginated recipients of a dispatch',
      description:
        "Page through a dispatch's recipients, optionally filtered by status " +
        'or a toAddress/contactCode substring. Use instead of the full ' +
        'dispatch-by-id read for large bulks.',
      tags: ['Communication log'],
      params: {
        id: { description: 'Dispatch id (UUID)', schema: z.string().uuid() },
      },
      query: {
        status: {
          description: 'Recipient status (repeatable)',
          schema: z.optional(z.array(z.string())),
        },
        q: {
          description: 'toAddress/contactCode substring',
          schema: z.string().optional(),
        },
        page: { description: 'Page (1-based)', schema: z.optional(z.number()) },
        limit: { description: 'Page size', schema: z.optional(z.number()) },
      },
      response: {
        200: paginatedResponseSchema(communication.MessageRecipientSchema),
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const rawStatus = ctx.query.status
        const status = rawStatus
          ? Array.isArray(rawStatus)
            ? rawStatus
            : [rawStatus]
          : undefined
        const q = typeof ctx.query.q === 'string' ? ctx.query.q : undefined
        ctx.status = 200
        ctx.body = await getDispatchRecipients(
          ctx.params.id,
          { status, q },
          ctx
        )
      } catch (error) {
        logger.error({ err: error }, 'failed to get dispatch recipients')
        ctx.status = 500
        ctx.body = {
          error: error instanceof Error ? error.message : 'unknown error',
        }
      }
    }
  )
}
