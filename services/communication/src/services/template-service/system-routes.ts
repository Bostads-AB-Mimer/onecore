import { OkapiRouter } from 'koa-okapi-router'
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  getSystemTemplateRecord,
  listSystemTemplates,
  SystemTemplateRecord,
  updateSystemTemplate,
  UpdateResult,
} from './adapters/db'
import {
  runValidation,
  templateChanged,
  VALIDATION_DESCRIPTION,
} from './route-helpers'
import { EmailLayoutConfigError, layoutChrome } from './render/layout'
import { TrustedHtml } from './render/trusted-html'
import { systemTemplateRules } from './system-template-rules'
import {
  renderEmail,
  SYSTEM_TEMPLATE_PLACEHOLDERS,
  SystemTemplateKey,
} from './system-templates'
import { validateTemplate } from './validation'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const keyParam = {
  key: {
    description: 'System template key, the same in every environment',
    schema: z.string(),
  },
}

const TAGS = ['System templates']

const notFound = {
  error: 'SYSTEM_TEMPLATE_NOT_FOUND',
  message: 'System template not found',
}

// The stored row plus what the editor needs around it: the placeholders the
// send supplies (with preview values), the logo and the locked footer.
const toSystemTemplate = (
  record: SystemTemplateRecord
): communication.SystemTemplate => {
  const examples = systemTemplateRules(record.key).examples
  return {
    ...record,
    placeholders: SYSTEM_TEMPLATE_PLACEHOLDERS[record.key].map((p) => {
      const example = examples[p.token]
      return {
        token: p.token,
        label: p.label,
        kind: p.kind,
        required: p.required ?? false,
        example: example instanceof TrustedHtml ? example.text : example,
      }
    }),
    ...layoutChrome(),
  }
}

const parseKey = (key: string): SystemTemplateKey | null => {
  const parsed = communication.SystemTemplateKeySchema.safeParse(key)
  return parsed.success ? parsed.data : null
}

// No auth here: core gates writes on the system-message-templates:write role.
// System templates are never created, archived or deleted: code sends them
// by key, and a missing one stops that email (SYSTEM_TEMPLATE_NOT_FOUND).
export const routes = (router: OkapiRouter) => {
  router.get(
    '/system-templates',
    {
      summary: 'List system email templates',
      description: 'The emails ONECore sends by key, alphabetical by name.',
      tags: TAGS,
      response: {
        200: z.array(communication.SystemTemplateSchema),
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      // Only the read is caught: the adapter logs it. Anything else reaches
      // errorHandler, which logs it too.
      let records: SystemTemplateRecord[]
      try {
        records = await listSystemTemplates()
      } catch {
        ctx.status = 500
        ctx.body = { error: 'TEMPLATE_READ_FAILED' }
        return
      }
      ctx.status = 200
      ctx.body = records.map(toSystemTemplate)
    }
  )

  router.get(
    '/system-templates/:key',
    {
      summary: 'Get a system email template',
      tags: TAGS,
      params: keyParam,
      response: {
        200: communication.SystemTemplateSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const key = parseKey(ctx.params.key)
      if (!key) {
        ctx.status = 404
        ctx.body = notFound
        return
      }
      let record: SystemTemplateRecord | null
      try {
        record = await getSystemTemplateRecord(key)
      } catch {
        ctx.status = 500
        ctx.body = { error: 'TEMPLATE_READ_FAILED' }
        return
      }
      if (!record) {
        ctx.status = 404
        ctx.body = notFound
        return
      }
      ctx.status = 200
      ctx.body = toSystemTemplate(record)
    }
  )

  router.put(
    '/system-templates/:key',
    {
      summary: 'Update a system email template',
      description:
        'Subject and body, live at once for every following send. Only if ' +
        'the template is still at `revision`: 409 TEMPLATE_CHANGED when ' +
        `someone saved in between. ${VALIDATION_DESCRIPTION}`,
      tags: TAGS,
      params: keyParam,
      body: communication.UpdateSystemTemplateParamsSchema,
      response: {
        200: communication.SystemTemplateSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const key = parseKey(ctx.params.key)
      if (!key) {
        ctx.status = 404
        ctx.body = notFound
        return
      }
      const parsed = communication.UpdateSystemTemplateParamsSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      const valid = runValidation(ctx, () =>
        validateTemplate(parsed.data, systemTemplateRules(key))
      )
      if (!valid) return
      let result: UpdateResult<SystemTemplateRecord>
      try {
        result = await updateSystemTemplate(key, parsed.data)
      } catch {
        ctx.status = 500
        ctx.body = { error: 'TEMPLATE_WRITE_FAILED' }
        return
      }
      if (!result.ok) {
        ctx.status = result.reason === 'conflict' ? 409 : 404
        ctx.body = result.reason === 'conflict' ? templateChanged : notFound
        return
      }
      logger.info(
        {
          key,
          revision: result.template.revision,
          updatedBy: result.template.updatedBy,
        },
        'System template updated'
      )
      ctx.status = 200
      ctx.body = toSystemTemplate(result.template)
    }
  )

  router.post(
    '/system-templates/:key/preview',
    {
      summary: 'Preview an unsaved system email',
      description:
        'Renders subject and body into the finished email (layout and ' +
        `footer) with example values. ${VALIDATION_DESCRIPTION} 500 ` +
        'EMAIL_CONFIG_MISSING when the organisation config is empty.',
      tags: TAGS,
      params: keyParam,
      body: communication.PreviewSystemTemplateSchema,
      response: {
        200: communication.SystemTemplatePreviewSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const key = parseKey(ctx.params.key)
      if (!key) {
        ctx.status = 404
        ctx.body = notFound
        return
      }
      const parsed = communication.PreviewSystemTemplateSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'INVALID_BODY', message: parsed.error.message }
        return
      }
      const rules = systemTemplateRules(key)
      const valid = runValidation(ctx, () =>
        validateTemplate(parsed.data, rules)
      )
      if (!valid) return
      try {
        const rendered = renderEmail(
          { systemKey: key, ...parsed.data },
          rules.examples
        )
        ctx.status = 200
        ctx.body = {
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }
      } catch (err: unknown) {
        if (!(err instanceof EmailLayoutConfigError)) throw err
        logger.error({ err, key }, 'System template preview: config missing')
        ctx.status = 500
        ctx.body = { error: err.code, message: err.message }
      }
    }
  )
}
