import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata } from '@onecore/utilities'
import { communication } from '@onecore/types'

import * as systemTemplatesAdapter from '../../adapters/communication-adapter/system-templates'
import { requireRole } from '../../middlewares/keycloak-auth'
import { getActingUserName } from '../../utils/acting-user'
import { registerSchema } from '../../utils/openapi'
import { SYSTEM_MESSAGE_TEMPLATES_WRITE_ROLE } from './constants'

const SystemTemplateCapabilitiesSchema = z.object({
  canEdit: z.boolean(),
})

const capabilitiesOf = (ctx: {
  state: { user?: { realm_access?: { roles?: string[] } } }
}) => ({
  canEdit: (ctx.state.user?.realm_access?.roles ?? []).includes(
    SYSTEM_MESSAGE_TEMPLATES_WRITE_ROLE
  ),
})

/**
 * System email templates (MIM-2291): the emails ONECore sends by key. Everyone
 * logged in may read them; editing and previewing unsaved text need the
 * `system-message-templates:write` realm role. A save is live at once. They
 * are never created, archived or deleted.
 *
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: System templates
 *     description: Emails ONECore sends by itself, edited by the comms team
 */
export const routes = (router: KoaRouter) => {
  registerSchema('SystemTemplate', communication.SystemTemplateSchema)
  registerSchema(
    'UpdateSystemTemplate',
    communication.UpdateSystemTemplateSchema
  )
  registerSchema(
    'PreviewSystemTemplate',
    communication.PreviewSystemTemplateSchema
  )
  registerSchema(
    'SystemTemplatePreview',
    communication.SystemTemplatePreviewSchema
  )
  registerSchema('SystemTemplateCapabilities', SystemTemplateCapabilitiesSchema)

  /**
   * @swagger
   * /system-templates:
   *   get:
   *     summary: List system email templates
   *     description: Alphabetical. `capabilities.canEdit` tells the client whether to offer editing.
   *     tags:
   *       - System templates
   *     responses:
   *       '200':
   *         description: System templates
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content, capabilities]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SystemTemplate'
   *                 capabilities:
   *                   $ref: '#/components/schemas/SystemTemplateCapabilities'
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/system-templates', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await systemTemplatesAdapter.listSystemTemplates()
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = {
      content: result.data,
      capabilities: capabilitiesOf(ctx),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /system-templates/{key}:
   *   get:
   *     summary: Get a system email template
   *     tags:
   *       - System templates
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: The template, with its placeholders, logo and footer
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content, capabilities]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/SystemTemplate'
   *                 capabilities:
   *                   $ref: '#/components/schemas/SystemTemplateCapabilities'
   *       '404':
   *         description: SYSTEM_TEMPLATE_NOT_FOUND
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/system-templates/:key', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await systemTemplatesAdapter.getSystemTemplate(
      ctx.params.key
    )
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = {
      content: result.data,
      capabilities: capabilitiesOf(ctx),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /system-templates/{key}:
   *   put:
   *     summary: Update a system email template
   *     description: |
   *       Requires the `system-message-templates:write` realm role. Live at
   *       once. Only if the template is still at `revision` (409
   *       TEMPLATE_CHANGED when someone saved in between). 400 with a code
   *       (UNKNOWN_PLACEHOLDER, MISSING_REQUIRED_PLACEHOLDER,
   *       PLACEHOLDER_NOT_ALONE, INVALID_URL, MISSING_PLACEHOLDER,
   *       INVALID_PLACEHOLDER_URL) when the email would fail or go out broken.
   *     tags:
   *       - System templates
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSystemTemplate'
   *     responses:
   *       '200':
   *         description: The saved template
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/SystemTemplate'
   *       '400':
   *         description: Invalid request body, or a validation code
   *       '403':
   *         description: Caller lacks the `system-message-templates:write` role
   *       '404':
   *         description: SYSTEM_TEMPLATE_NOT_FOUND
   *       '409':
   *         description: TEMPLATE_CHANGED
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '(.*)/system-templates/:key',
    requireRole(SYSTEM_MESSAGE_TEMPLATES_WRITE_ROLE),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const parsed = communication.UpdateSystemTemplateSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = {
          error: 'INVALID_BODY',
          errors: parsed.error.issues,
          ...metadata,
        }
        return
      }

      const result = await systemTemplatesAdapter.updateSystemTemplate(
        ctx.params.key,
        { ...parsed.data, updatedBy: getActingUserName(ctx) ?? null }
      )
      if (!result.ok) {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /system-templates/{key}/preview:
   *   post:
   *     summary: Preview an unsaved system email
   *     description: |
   *       Requires the `system-message-templates:write` realm role. Renders
   *       the finished email (layout and footer) with example values. Same
   *       400 codes as the update; 500 EMAIL_CONFIG_MISSING when the
   *       organisation config is empty.
   *     tags:
   *       - System templates
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PreviewSystemTemplate'
   *     responses:
   *       '200':
   *         description: The rendered email
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/SystemTemplatePreview'
   *       '400':
   *         description: Invalid request body, or a validation code
   *       '403':
   *         description: Caller lacks the `system-message-templates:write` role
   *       '404':
   *         description: SYSTEM_TEMPLATE_NOT_FOUND
   *       '500':
   *         description: EMAIL_CONFIG_MISSING or internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '(.*)/system-templates/:key/preview',
    requireRole(SYSTEM_MESSAGE_TEMPLATES_WRITE_ROLE),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const parsed = communication.PreviewSystemTemplateSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = {
          error: 'INVALID_BODY',
          errors: parsed.error.issues,
          ...metadata,
        }
        return
      }

      const result = await systemTemplatesAdapter.previewSystemTemplate(
        ctx.params.key,
        parsed.data
      )
      if (!result.ok) {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )
}
