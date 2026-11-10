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
  evaluateSendAt,
  getScheduleRules,
  toScheduleConfig,
} from '../scheduled-sends/rules'

const LogOutboundResponseSchema = z.object({
  dispatchId: z.string().uuid(),
})

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

// Recipient statuses that mean the worker has already taken the row: a
// dispatch with any of these can no longer be rescheduled (MIM-1838).
const PROCESSED_STATUSES: ReadonlySet<communication.RecipientStatus> = new Set([
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'received',
  'pending',
])

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
        "Marks every still-'scheduled' recipient as 'cancelled' so the " +
        'scheduled-sends worker never sends them. Allowed until no ' +
        "'scheduled' recipient remains: a partly processed dispatch cancels " +
        'the rest and returns the count. Idempotent: an already-cancelled ' +
        'dispatch returns 200 with 0. 409 ALREADY_PROCESSED when every ' +
        'recipient has been claimed or sent.',
      tags: ['Communication log'],
      params: {
        id: { description: 'Dispatch id (UUID)', schema: z.string().uuid() },
      },
      response: {
        200: communication.CancelDispatchResponseSchema,
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

        // The update only touches 'scheduled' rows, so 0 means the worker
        // took the last one between our read and the write.
        const { updatedCount } = statuses.includes('scheduled')
          ? await cancelScheduledRecipients(ctx.params.id)
          : { updatedCount: 0 }
        if (updatedCount === 0) {
          ctx.status = 409
          ctx.body = {
            error: 'ALREADY_PROCESSED',
            message: 'No scheduled recipients left to cancel',
          }
          return
        }

        ctx.status = 200
        ctx.body = {
          dispatchId: ctx.params.id,
          cancelledRecipients: updatedCount,
        }
      } catch (error) {
        logger.error({ err: error }, 'failed to cancel scheduled dispatch')
        ctx.status = 500
        ctx.body = { error: 'CANCEL_FAILED' }
      }
    }
  )

  router.post(
    '/communication-log/dispatches/:id/reschedule',
    {
      summary: 'Move a scheduled dispatch to a new send time',
      description:
        "Updates the dispatch's sendAt, earlier or later. The new time must " +
        'follow the scheduling rules (future, within max days ahead, on a ' +
        '10-minute slot, outside blocked hours; see /schedule-config) — each ' +
        'violation is a 400 with its code. Only while no recipient has been ' +
        'claimed or sent: 409 ALREADY_PROCESSED otherwise, since moving an ' +
        'overdue dispatch would reset its staleness clock.',
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
        const statuses = dispatch.recipients.map((r) => r.status)
        if (
          !statuses.includes('scheduled') ||
          statuses.some((s) => PROCESSED_STATUSES.has(s))
        ) {
          ctx.status = 409
          ctx.body = {
            error: 'ALREADY_PROCESSED',
            message: 'Dispatch is no longer (fully) scheduled',
          }
          return
        }

        const evaluation = evaluateSendAt(
          ctx.request.body.sendAt,
          getScheduleRules()
        )
        if (evaluation.kind === 'invalid') {
          ctx.status = 400
          ctx.body = { error: evaluation.code, message: evaluation.message }
          return
        }
        // 'immediate' (within the grace window) is not a valid reschedule
        // target — the point of rescheduling is a concrete future slot.
        if (evaluation.kind !== 'scheduled') {
          ctx.status = 400
          ctx.body = { error: 'SEND_AT_TOO_SOON' }
          return
        }

        // Conditional update: 0 rows means the worker claimed a recipient
        // between our read and the write.
        const { updatedCount } = await updateDispatchSendAt(
          ctx.params.id,
          evaluation.sendAt
        )
        if (updatedCount === 0) {
          ctx.status = 409
          ctx.body = {
            error: 'ALREADY_PROCESSED',
            message: 'Dispatch was claimed by the worker',
          }
          return
        }

        ctx.status = 200
        ctx.body = {
          dispatchId: ctx.params.id,
          sendAt: evaluation.sendAt.toISOString(),
        }
      } catch (error) {
        logger.error({ err: error }, 'failed to reschedule dispatch')
        ctx.status = 500
        ctx.body = { error: 'RESCHEDULE_FAILED' }
      }
    }
  )

  router.get(
    '/communication-log/schedule-config',
    {
      summary: 'Scheduling rules for scheduled sends',
      description:
        'The rules the bulk send and reschedule routes enforce on sendAt, so ' +
        'a picker can offer only valid times: enabled flag, slot length, ' +
        'daily blocked window (wall-clock in timeZone) and max days ahead.',
      tags: ['Communication log'],
      response: {
        200: communication.ScheduleConfigSchema,
      },
    },
    async (ctx) => {
      ctx.status = 200
      ctx.body = toScheduleConfig(getScheduleRules())
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
          description: "'sms' | 'email' | 'my-pages' (repeatable)",
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
