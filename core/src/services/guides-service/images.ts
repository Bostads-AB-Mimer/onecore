import { randomUUID } from 'crypto'
import KoaRouter from '@koa/router'
import { guides } from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import { guides as guidesAdapter } from '../../adapters/communication-adapter'
import * as fileStorageAdapter from '../../adapters/file-storage-adapter'
import { deleteStorageFiles, withImageUrl } from './helpers'

// Nothing downstream validates uploads, so limits are enforced here.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /guides/{id}/steps/{stepId}/images:
   *   post:
   *     summary: Upload an image to a guide step
   *     description: Requires the guides-admin role. Accepts PNG, JPEG or WEBP up to 5 MB as base64, stores the file under guide/{guideId}/ and appends the image last on the step.
   *     tags: [Guides]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: path
   *         name: stepId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GuideImageUploadRequest'
   *     responses:
   *       200:
   *         description: The stored image with a presigned url
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/GuideStepImageWithUrl'
   *       400:
   *         description: Invalid file type or size
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Guide or step not found
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
  router.post('/guides/:id/steps/:stepId/images', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const parsed = guides.GuideImageUploadRequestSchema.safeParse(
      ctx.request.body
    )
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { error: 'Validation failed', ...metadata }
      return
    }

    const { fileName, fileData, contentType, altText, caption } = parsed.data
    const extension = ALLOWED_IMAGE_TYPES[contentType]
    if (!extension) {
      ctx.status = 400
      ctx.body = { error: 'invalid-file-type', ...metadata }
      return
    }

    const buffer = Buffer.from(fileData, 'base64')
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      ctx.status = 400
      ctx.body = { error: 'invalid-file-size', ...metadata }
      return
    }

    const storageKey = `guide/${ctx.params.id}/${randomUUID()}.${extension}`

    const uploadResult = await fileStorageAdapter.uploadFile(
      storageKey,
      buffer,
      contentType
    )
    if (!uploadResult.ok) {
      logger.error(
        { err: uploadResult.err, metadata },
        'Error uploading guide image to storage'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const imageResult = await guidesAdapter.createStepImage(
      ctx.params.id,
      ctx.params.stepId,
      {
        id: randomUUID(),
        storageKey,
        filename: fileName,
        contentType,
        altText,
        caption,
      }
    )
    if (!imageResult.ok) {
      // Compensate: the metadata row was never written, so drop the file.
      await deleteStorageFiles([storageKey])
      if (imageResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Guide or step not found', ...metadata }
        return
      }
      logger.error(
        { err: imageResult.err, metadata },
        'Error recording guide image, compensating'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: await withImageUrl(imageResult.data), ...metadata }
  })

  /**
   * @swagger
   * /guides/{id}/images/{imageId}:
   *   delete:
   *     summary: Delete a guide step image
   *     description: Requires the guides-admin role. Removes the image row and the stored file.
   *     tags: [Guides]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: path
   *         name: imageId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Image deleted
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
   *         description: Image not found
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
  router.delete('/guides/:id/images/:imageId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await guidesAdapter.deleteStepImage(
      ctx.params.id,
      ctx.params.imageId
    )
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Image not found', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error deleting guide image')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await deleteStorageFiles([result.data.storageKey])

    ctx.status = 200
    ctx.body = { content: { deleted: true }, ...metadata }
  })
}
