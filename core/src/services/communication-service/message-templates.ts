import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { communication } from '@onecore/types'

import * as templatesAdapter from '../../adapters/communication-adapter/message-templates'
import { registerSchema } from '../../utils/openapi'

/**
 * SMS templates (MIM-1838): CRUD + archive/restore proxied to the
 * communication service. No role gate yet — anyone who can send SMS can
 * manage templates (the spec defers role-based permissions); login is still
 * required like every core route.
 *
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Message templates
 *     description: Prefilled SMS texts reps pick in the SMS modal
 */
export const routes = (router: KoaRouter) => {
  registerSchema('MessageTemplate', communication.TemplateSchema)
  registerSchema('CreateMessageTemplate', communication.CreateTemplateSchema)
  registerSchema('UpdateMessageTemplate', communication.UpdateTemplateSchema)

  /**
   * @swagger
   * /message-templates:
   *   get:
   *     summary: List message templates
   *     description: Alphabetical. `status=active` (default) hides archived templates; `archived` lists only those; `all` lists both.
   *     tags:
   *       - Message templates
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, archived, all]
   *     responses:
   *       '200':
   *         description: Templates
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MessageTemplate'
   *       '400':
   *         description: Invalid status filter
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/message-templates', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['status'])
    const parsed = communication.TemplateStatusFilterSchema.default(
      'active'
    ).safeParse(ctx.query.status)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { error: 'INVALID_STATUS_FILTER', ...metadata }
      return
    }

    const result = await templatesAdapter.listTemplates(parsed.data)
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /message-templates/{id}:
   *   get:
   *     summary: Get a message template
   *     tags:
   *       - Message templates
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       '200':
   *         description: The template (archived ones resolve too)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/MessageTemplate'
   *       '404':
   *         description: TEMPLATE_NOT_FOUND
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/message-templates/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await templatesAdapter.getTemplate(ctx.params.id)
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /message-templates:
   *   post:
   *     summary: Create an SMS template
   *     description: Name must be unique among active templates (409 TEMPLATE_NAME_TAKEN otherwise).
   *     tags:
   *       - Message templates
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateMessageTemplate'
   *     responses:
   *       '201':
   *         description: The created template
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/MessageTemplate'
   *       '400':
   *         description: Invalid request body
   *       '409':
   *         description: TEMPLATE_NAME_TAKEN
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/message-templates', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = communication.CreateTemplateSchema.safeParse(
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

    const result = await templatesAdapter.createTemplate(parsed.data)
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /message-templates/{id}:
   *   put:
   *     summary: Update a template in place
   *     description: Only the supplied fields change. Past dispatches keep their sent text; only the "Mall" label follows a rename.
   *     tags:
   *       - Message templates
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateMessageTemplate'
   *     responses:
   *       '200':
   *         description: The updated template
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/MessageTemplate'
   *       '400':
   *         description: Invalid or empty request body
   *       '404':
   *         description: TEMPLATE_NOT_FOUND
   *       '409':
   *         description: TEMPLATE_NAME_TAKEN
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/message-templates/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = communication.UpdateTemplateSchema.safeParse(
      ctx.request.body
    )
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      ctx.status = 400
      ctx.body = {
        error: parsed.success ? 'NO_FIELDS' : 'INVALID_BODY',
        errors: parsed.success ? [] : parsed.error.issues,
        ...metadata,
      }
      return
    }

    const result = await templatesAdapter.updateTemplate(
      ctx.params.id,
      parsed.data
    )
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /message-templates/{id}/archive:
   *   post:
   *     summary: Archive a template
   *     description: Hidden from the picker and the default list; past dispatches still show its name. Idempotent.
   *     tags:
   *       - Message templates
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       '200':
   *         description: The archived template
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/MessageTemplate'
   *       '404':
   *         description: TEMPLATE_NOT_FOUND
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/message-templates/:id/archive', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await templatesAdapter.archiveTemplate(ctx.params.id)
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /message-templates/{id}/restore:
   *   post:
   *     summary: Restore an archived template
   *     description: Makes it active again; 409 TEMPLATE_NAME_TAKEN when an active template holds the name.
   *     tags:
   *       - Message templates
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       '200':
   *         description: The restored template
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/MessageTemplate'
   *       '404':
   *         description: TEMPLATE_NOT_FOUND
   *       '409':
   *         description: TEMPLATE_NAME_TAKEN
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/message-templates/:id/restore', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await templatesAdapter.restoreTemplate(ctx.params.id)
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }
    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
