import KoaRouter from '@koa/router'
import { guides } from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { ZodError } from 'zod'

import { guides as guidesAdapter } from '../../adapters/communication-adapter'
import {
  actingUserName,
  deleteStorageFiles,
  isGuidesAdmin,
  withImageUrls,
} from './helpers'

const validationErrorBody = (error: ZodError) => ({
  error: 'Validation failed',
  issues: error.issues.map(({ path, message }) => ({ path, message })),
})

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /guides:
   *   get:
   *     summary: List guides
   *     description: Published guides ordered by category and title. Users with the guides-admin role may pass includeDrafts=true to also see drafts.
   *     tags: [Guides]
   *     parameters:
   *       - in: query
   *         name: includeDrafts
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Guide summaries
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/GuideSummary'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/guides', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const includeDrafts =
      ctx.query.includeDrafts === 'true' && isGuidesAdmin(ctx)

    const result = await guidesAdapter.listGuides({ includeDrafts })
    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error listing guides')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /guides/categories:
   *   get:
   *     summary: List guide categories
   *     tags: [Guides]
   *     responses:
   *       200:
   *         description: Categories ordered by name
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/GuideCategory'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/guides/categories', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await guidesAdapter.listCategories()
    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error listing guide categories'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /guides/by-slug/{slug}:
   *   get:
   *     summary: Get a guide by slug
   *     description: Resolves old slugs through the slug history; redirectedFrom is set when that happens. A draft is returned in full to guides-admin users and as an UnpublishedGuide notice to everyone else.
   *     tags: [Guides]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The guide with presigned image urls, or an unpublished notice
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   oneOf:
   *                     - $ref: '#/components/schemas/GuideWithUrls'
   *                     - $ref: '#/components/schemas/UnpublishedGuide'
   *       404:
   *         description: Guide not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/guides/by-slug/:slug', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await guidesAdapter.getGuideBySlug(ctx.params.slug)
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Guide not found', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error fetching guide')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    if (result.data.status === 'draft' && !isGuidesAdmin(ctx)) {
      const notice: guides.UnpublishedGuide = {
        slug: result.data.slug,
        title: result.data.title,
        unpublished: true,
      }
      ctx.status = 200
      ctx.body = { content: notice, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: await withImageUrls(result.data), ...metadata }
  })

  /**
   * @swagger
   * /guides/{id}:
   *   get:
   *     summary: Get a guide by id
   *     description: Used by the editor. Drafts are only returned to guides-admin users.
   *     tags: [Guides]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: The guide with presigned image urls
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/GuideWithUrls'
   *       403:
   *         description: Draft requested without the guides-admin role
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Guide not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/guides/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await guidesAdapter.getGuideById(ctx.params.id)
    if (!result.ok) {
      if (result.err === 'not-found' || result.err === 'bad-request') {
        ctx.status = 404
        ctx.body = { reason: 'Guide not found', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error fetching guide')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    if (result.data.status === 'draft' && !isGuidesAdmin(ctx)) {
      ctx.status = 403
      ctx.body = { reason: 'Guide is not published', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: await withImageUrls(result.data), ...metadata }
  })

  /**
   * @swagger
   * /guides:
   *   post:
   *     summary: Create a guide
   *     description: Requires the guides-admin role. Images are added afterwards through the image upload endpoint.
   *     tags: [Guides]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateGuideRequest'
   *     responses:
   *       200:
   *         description: The created guide
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/GuideWithUrls'
   *       400:
   *         description: Validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Slug already taken
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/guides', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const parsed = guides.CreateGuideRequestSchema.safeParse(ctx.request.body)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { ...validationErrorBody(parsed.error), ...metadata }
      return
    }

    const result = await guidesAdapter.createGuide({
      ...parsed.data,
      author: actingUserName(ctx),
    })
    if (!result.ok) {
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = { error: 'slug-taken', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Validation failed', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error creating guide')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: await withImageUrls(result.data), ...metadata }
  })

  /**
   * @swagger
   * /guides/{id}:
   *   put:
   *     summary: Update a guide
   *     description: Requires the guides-admin role. Replaces metadata and steps; steps missing from the payload are deleted together with their images, and the files are removed from storage.
   *     tags: [Guides]
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
   *             $ref: '#/components/schemas/UpdateGuideRequest'
   *     responses:
   *       200:
   *         description: The updated guide
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/GuideWithUrls'
   *       400:
   *         description: Validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Guide not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       409:
   *         description: Slug already taken
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.put('/guides/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const parsed = guides.UpdateGuideRequestSchema.safeParse(ctx.request.body)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { ...validationErrorBody(parsed.error), ...metadata }
      return
    }

    const result = await guidesAdapter.updateGuide(ctx.params.id, {
      ...parsed.data,
      author: actingUserName(ctx),
    })
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Guide not found', ...metadata }
        return
      }
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = { error: 'slug-taken', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Validation failed', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error updating guide')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await deleteStorageFiles(result.data.removedStorageKeys)

    ctx.status = 200
    ctx.body = { content: await withImageUrls(result.data.guide), ...metadata }
  })

  /**
   * @swagger
   * /guides/{id}:
   *   delete:
   *     summary: Delete a guide
   *     description: Requires the guides-admin role. Removes the guide, its steps, image rows and image files.
   *     tags: [Guides]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Guide deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     deleted:
   *                       type: boolean
   *       404:
   *         description: Guide not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/guides/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await guidesAdapter.deleteGuide(ctx.params.id)
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Guide not found', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error deleting guide')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await deleteStorageFiles(result.data.storageKeys)

    ctx.status = 200
    ctx.body = { content: { deleted: true }, ...metadata }
  })
}
