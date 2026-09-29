import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata } from '@onecore/utilities'
import { communication } from '@onecore/types'

import * as releaseNotesAdapter from '../../adapters/communication-adapter/release-notes'
import { requireRole } from '../../middlewares/keycloak-auth'
import { getActingUserName } from '../../utils/acting-user'
import { registerSchema } from '../../utils/openapi'
import { RELEASE_NOTES_WRITE_ROLE } from './constants'

const ListQuerySchema = z.object({
  app: communication.ReleaseNoteAppSchema.optional(),
  includeDrafts: z.enum(['true', 'false']).optional(),
})

const ReleaseNoteCapabilitiesSchema = z.object({
  canManage: z.boolean(),
})

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Release notes
 *     description: News and release notes shown in the ONECore apps
 */
export const routes = (router: KoaRouter) => {
  registerSchema('ReleaseNote', communication.ReleaseNoteSchema)
  registerSchema('CreateReleaseNote', communication.CreateReleaseNoteSchema)
  registerSchema('UpdateReleaseNote', communication.UpdateReleaseNoteSchema)
  registerSchema('ReleaseNoteCapabilities', ReleaseNoteCapabilitiesSchema)

  /**
   * @swagger
   * /release-notes:
   *   get:
   *     summary: List release notes
   *     description: |
   *       Pinned notes first, then newest. Open to every authenticated user.
   *       `includeDrafts` is honoured only for callers holding the
   *       `release-notes:write` realm role; it is ignored otherwise.
   *       `capabilities.canManage` tells the client whether to show admin UI.
   *     tags:
   *       - Release notes
   *     parameters:
   *       - in: query
   *         name: app
   *         schema:
   *           type: string
   *           enum: [general, property-tree, keys-portal, internal-portal, mina-sidor, sok-ledigt, odoo, core, leasing, property, work-order, keys, communication, contacts, inspection, economy]
   *         description: Only notes concerning this app
   *       - in: query
   *         name: includeDrafts
   *         schema:
   *           type: boolean
   *         description: Include drafts and scheduled notes (requires release-notes:write)
   *     responses:
   *       200:
   *         description: List of release notes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content, capabilities]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ReleaseNote'
   *                 capabilities:
   *                   $ref: '#/components/schemas/ReleaseNoteCapabilities'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/release-notes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['app', 'includeDrafts'])

    const parsed = ListQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameters', ...metadata }
      return
    }

    const userRoles: string[] = ctx.state.user?.realm_access?.roles ?? []
    const canManage = userRoles.includes(RELEASE_NOTES_WRITE_ROLE)

    const result = await releaseNotesAdapter.listReleaseNotes({
      app: parsed.data.app,
      includeDrafts: canManage && parsed.data.includeDrafts === 'true',
    })

    if (!result.ok) {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: result.data,
      capabilities: { canManage },
      ...metadata,
    }
  })

  /**
   * @swagger
   * /release-notes:
   *   post:
   *     summary: Create a release note
   *     description: |
   *       Requires the `release-notes:write` realm role. Omit `publishedAt`
   *       (or pass null) to save a draft. `createdBy` is taken from the token.
   *     tags:
   *       - Release notes
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateReleaseNote'
   *     responses:
   *       201:
   *         description: The created release note
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ReleaseNote'
   *       400:
   *         description: Invalid request body
   *       403:
   *         description: Caller lacks the `release-notes:write` role
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '(.*)/release-notes',
    requireRole(RELEASE_NOTES_WRITE_ROLE),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const parsed = communication.CreateReleaseNoteSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid request body',
          errors: parsed.error.issues,
          ...metadata,
        }
        return
      }

      const result = await releaseNotesAdapter.createReleaseNote({
        ...parsed.data,
        createdBy: getActingUserName(ctx) ?? null,
      })

      if (!result.ok) {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 201
      ctx.body = { content: result.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /release-notes/{id}:
   *   put:
   *     summary: Update a release note
   *     description: |
   *       Requires the `release-notes:write` realm role. Only the supplied
   *       fields change. Pass `publishedAt: null` to unpublish.
   *     tags:
   *       - Release notes
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
   *             $ref: '#/components/schemas/UpdateReleaseNote'
   *     responses:
   *       200:
   *         description: The updated release note
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ReleaseNote'
   *       400:
   *         description: Invalid request body
   *       403:
   *         description: Caller lacks the `release-notes:write` role
   *       404:
   *         description: Release note not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '(.*)/release-notes/:id',
    requireRole(RELEASE_NOTES_WRITE_ROLE),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const parsed = communication.UpdateReleaseNoteSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success || Object.keys(parsed.data).length === 0) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid request body',
          errors: parsed.success ? [] : parsed.error.issues,
          ...metadata,
        }
        return
      }

      const result = await releaseNotesAdapter.updateReleaseNote(
        ctx.params.id,
        parsed.data
      )

      if (!result.ok) {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /release-notes/{id}:
   *   delete:
   *     summary: Delete a release note
   *     description: Requires the `release-notes:write` realm role.
   *     tags:
   *       - Release notes
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Release note deleted
   *       403:
   *         description: Caller lacks the `release-notes:write` role
   *       404:
   *         description: Release note not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete(
    '(.*)/release-notes/:id',
    requireRole(RELEASE_NOTES_WRITE_ROLE),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await releaseNotesAdapter.deleteReleaseNote(ctx.params.id)

      if (!result.ok) {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 204
    }
  )
}
