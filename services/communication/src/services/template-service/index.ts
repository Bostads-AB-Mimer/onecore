import { OkapiRouter } from 'koa-okapi-router'
import { communication } from '@onecore/types'
import { z } from 'zod'

import {
  createTemplate,
  getTemplateById,
  isUniqueNameViolation,
  listTemplates,
  setTemplateActive,
  updateTemplate,
} from './adapters/db'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const idParam = {
  id: { description: 'Template id (UUID)', schema: z.string().uuid() },
}

const TAGS = ['Message templates']

const notFound = { error: 'TEMPLATE_NOT_FOUND', message: 'Template not found' }
const nameTaken = {
  error: 'TEMPLATE_NAME_TAKEN',
  message: 'An active template with that name already exists',
}

// Shared failure mapping for every write: the filtered unique index on active
// names answers 409; anything else is a real failure the adapter already logged.
const handleWriteError = (
  ctx: { status: number; body: unknown },
  error: unknown
) => {
  if (isUniqueNameViolation(error)) {
    ctx.status = 409
    ctx.body = nameTaken
    return
  }
  ctx.status = 500
  ctx.body = { error: 'TEMPLATE_WRITE_FAILED' }
}

// No auth here: core's login gate decides who may manage templates (anyone
// who can send SMS, until role-based permissions are added). Failures are
// logged once, in the adapter; these handlers only map them to a status.
export const routes = (router: OkapiRouter) => {
  router.get(
    '/message-templates',
    {
      summary: 'List message templates',
      description:
        'Alphabetical by name. status=active (default) hides archived ' +
        'templates; archived lists only those; all lists both. SMS only for ' +
        'now (channels is always ["sms"]).',
      tags: TAGS,
      query: {
        status: {
          description: 'active | archived | all (default active)',
          schema: z.optional(communication.TemplateStatusFilterSchema),
        },
      },
      response: {
        200: z.array(communication.TemplateSchema),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.TemplateStatusFilterSchema.default(
        'active'
      ).safeParse(ctx.query.status)
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_STATUS_FILTER' }
        return
      }
      try {
        ctx.status = 200
        ctx.body = await listTemplates(parsed.data)
      } catch {
        ctx.status = 500
        ctx.body = { error: 'TEMPLATE_READ_FAILED' }
      }
    }
  )

  router.get(
    '/message-templates/:id',
    {
      summary: 'Get a message template by id',
      description: 'Archived templates resolve too (the log links to them).',
      tags: TAGS,
      params: idParam,
      response: {
        200: communication.TemplateSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const template = await getTemplateById(ctx.params.id)
        if (!template) {
          ctx.status = 404
          ctx.body = notFound
          return
        }
        ctx.status = 200
        ctx.body = template
      } catch {
        ctx.status = 500
        ctx.body = { error: 'TEMPLATE_READ_FAILED' }
      }
    }
  )

  router.post(
    '/message-templates',
    {
      summary: 'Create an SMS template',
      description:
        'Name must be unique among active templates (case-insensitive): ' +
        '409 TEMPLATE_NAME_TAKEN otherwise.',
      tags: TAGS,
      body: communication.CreateTemplateSchema,
      response: {
        201: communication.TemplateSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.CreateTemplateSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      try {
        ctx.status = 201
        ctx.body = await createTemplate(parsed.data)
      } catch (error: unknown) {
        handleWriteError(ctx, error)
      }
    }
  )

  router.put(
    '/message-templates/:id',
    {
      summary: 'Update a template in place',
      description:
        'Only the supplied fields change. Past dispatches keep their sent ' +
        'text; only the "Mall: <name>" label follows a rename. 409 ' +
        'TEMPLATE_NAME_TAKEN when renaming into an active name.',
      tags: TAGS,
      params: idParam,
      body: communication.UpdateTemplateSchema,
      response: {
        200: communication.TemplateSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.UpdateTemplateSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      if (Object.keys(parsed.data).length === 0) {
        ctx.status = 400
        ctx.body = { error: 'NO_FIELDS', message: 'No fields to update' }
        return
      }
      try {
        const updated = await updateTemplate(ctx.params.id, parsed.data)
        if (!updated) {
          ctx.status = 404
          ctx.body = notFound
          return
        }
        ctx.status = 200
        ctx.body = updated
      } catch (error: unknown) {
        handleWriteError(ctx, error)
      }
    }
  )

  router.post(
    '/message-templates/:id/archive',
    {
      summary: 'Archive a template',
      description:
        'Hides it from the picker and the default list. Past dispatches ' +
        'still resolve its name. Idempotent.',
      tags: TAGS,
      params: idParam,
      response: {
        200: communication.TemplateSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const updated = await setTemplateActive(ctx.params.id, false)
        if (!updated) {
          ctx.status = 404
          ctx.body = notFound
          return
        }
        ctx.status = 200
        ctx.body = updated
      } catch (error: unknown) {
        handleWriteError(ctx, error)
      }
    }
  )

  router.post(
    '/message-templates/:id/restore',
    {
      summary: 'Restore an archived template',
      description:
        'Makes it active again. 409 TEMPLATE_NAME_TAKEN when an active ' +
        'template has taken the name meanwhile.',
      tags: TAGS,
      params: idParam,
      response: {
        200: communication.TemplateSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const updated = await setTemplateActive(ctx.params.id, true)
        if (!updated) {
          ctx.status = 404
          ctx.body = notFound
          return
        }
        ctx.status = 200
        ctx.body = updated
      } catch (error: unknown) {
        handleWriteError(ctx, error)
      }
    }
  )
}
