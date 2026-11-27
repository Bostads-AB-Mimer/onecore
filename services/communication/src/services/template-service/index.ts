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
import {
  runValidation,
  templateChanged,
  VALIDATION_DESCRIPTION,
} from './route-helpers'
import { REP_TEMPLATE_RULES, validateTemplate } from './validation'

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
// System templates have their own routes (system-routes.ts).
export const routes = (router: OkapiRouter) => {
  router.get(
    '/message-templates',
    {
      summary: 'List message templates',
      description:
        'Alphabetical by name. status=active (default) hides archived ' +
        'templates; archived lists only those; all lists both. SMS only for ' +
        'now (channels is always ["sms"]); smsText is the body with the ' +
        'markdown stripped.',
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
        'The body is markdown; its SMS text (markdown stripped) may be at ' +
        'most 1600 characters (400 SMS_TEXT_TOO_LONG). Name must be unique ' +
        'among active templates (case-insensitive): 409 TEMPLATE_NAME_TAKEN ' +
        `otherwise. ${VALIDATION_DESCRIPTION}`,
      tags: TAGS,
      body: communication.CreateTemplateParamsSchema,
      response: {
        201: communication.TemplateSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.CreateTemplateParamsSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      const { body } = parsed.data
      const valid = runValidation(ctx, () =>
        validateTemplate({ subject: null, body }, REP_TEMPLATE_RULES)
      )
      if (!valid) return
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
        'Only the supplied name/body change, and only if the template is ' +
        'still at `revision`: 409 TEMPLATE_CHANGED when someone saved in ' +
        'between. Past dispatches keep their sent text; only the "Mall: ' +
        '<name>" label follows a rename. 409 TEMPLATE_NAME_TAKEN when ' +
        `renaming into an active name. ${VALIDATION_DESCRIPTION}`,
      tags: TAGS,
      params: idParam,
      body: communication.UpdateTemplateParamsSchema,
      response: {
        200: communication.TemplateSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.UpdateTemplateParamsSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      const { name, body } = parsed.data
      if (name === undefined && body === undefined) {
        ctx.status = 400
        ctx.body = { error: 'NO_FIELDS', message: 'No fields to update' }
        return
      }
      if (
        body !== undefined &&
        !runValidation(ctx, () =>
          validateTemplate({ subject: null, body }, REP_TEMPLATE_RULES)
        )
      ) {
        return
      }
      try {
        const result = await updateTemplate(ctx.params.id, parsed.data)
        if (!result.ok) {
          ctx.status = result.reason === 'conflict' ? 409 : 404
          ctx.body = result.reason === 'conflict' ? templateChanged : notFound
          return
        }
        ctx.status = 200
        ctx.body = result.template
      } catch (error: unknown) {
        handleWriteError(ctx, error)
      }
    }
  )

  router.post(
    '/message-templates/preview',
    {
      summary: 'Preview an SMS template',
      description:
        'The SMS text of an unsaved body (markdown stripped), for the ' +
        `editor's preview and length counter. ${VALIDATION_DESCRIPTION} ` +
        'SMS_TEXT_TOO_LONG is not reported here: the editor shows the length.',
      tags: TAGS,
      body: communication.PreviewTemplateSchema,
      response: {
        200: communication.TemplatePreviewSchema,
        400: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.PreviewTemplateSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      const { body } = parsed.data
      const rules = { ...REP_TEMPLATE_RULES, smsTextLimit: undefined }
      const preview = runValidation(ctx, () =>
        validateTemplate({ subject: null, body }, rules)
      )
      if (!preview) return
      ctx.status = 200
      ctx.body = { text: preview.text }
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
