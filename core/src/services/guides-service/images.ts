import { randomUUID } from 'crypto'
import KoaRouter from '@koa/router'
import { guides } from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import { guides as guidesAdapter } from '../../adapters/communication-adapter'
import * as fileStorageAdapter from '../../adapters/file-storage-adapter'
import {
  deleteStorageFiles,
  isPlainBase64,
  isUuidParam,
  matchesImageMagicBytes,
  upstreamErrorBody,
  withImageUrl,
} from './helpers'
import { GUIDE_STORAGE_PREFIX } from './constants'

// Nothing downstream validates uploads, so limits are enforced here.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
// File extension for each accepted content type. Keyed by the validated enum,
// so the lookup below is total and never reaches Object.prototype.
export const ALLOWED_IMAGE_TYPES: Record<guides.GuideImageContentType, string> =
  {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  }

// Base64 grows by 4/3, rounded up to a 4-character group plus padding. Anything
// longer is rejected before Buffer.from so an oversized payload is never decoded.
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /guides/{id}/steps/{stepId}/images:
   *   post:
   *     summary: Upload an image to a guide step
   *     description: Requires the guides-admin role. Accepts PNG, JPEG or WEBP up to 5 MB as base64, stores the file under guide/{guideId}/ and appends the image last on the step. A published guide only accepts images with a non-blank altText, since the image is visible to readers at once. The upload bumps the guide's updatedAt; the new value is returned as guideUpdatedAt and must be sent as expectedUpdatedAt on the next save.
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
   *         description: The stored image with a presigned url, and the guide's new updatedAt
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/GuideImageUploadResponse'
   *       400:
   *         description: "Rejected upload: invalid-file-type (unsupported content type or magic bytes that do not match it), invalid-file-size, invalid-file-data (not plain base64), or the error code proxied from the communication service (alt-text-required when the guide is published and altText is missing or blank)"
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

    if (!isUuidParam(ctx.params.id) || !isUuidParam(ctx.params.stepId)) {
      ctx.status = 404
      ctx.body = { reason: 'Guide or step not found', ...metadata }
      return
    }

    const parsed = guides.GuideImageUploadRequestSchema.safeParse(
      ctx.request.body
    )
    if (!parsed.success) {
      // An unsupported content type keeps its own code so the client can tell
      // the user which formats are accepted.
      const invalidContentType = parsed.error.issues.some(
        (issue) => issue.path[0] === 'contentType'
      )
      ctx.status = 400
      ctx.body = {
        error: invalidContentType ? 'invalid-file-type' : 'Validation failed',
        ...metadata,
      }
      return
    }

    const { fileName, fileData, contentType, altText, caption } = parsed.data
    const extension = ALLOWED_IMAGE_TYPES[contentType]

    if (fileData.length > MAX_BASE64_LENGTH) {
      ctx.status = 400
      ctx.body = { error: 'invalid-file-size', ...metadata }
      return
    }

    if (!isPlainBase64(fileData)) {
      ctx.status = 400
      ctx.body = { error: 'invalid-file-data', ...metadata }
      return
    }

    const buffer = Buffer.from(fileData, 'base64')
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      ctx.status = 400
      ctx.body = { error: 'invalid-file-size', ...metadata }
      return
    }

    if (!matchesImageMagicBytes(buffer, contentType)) {
      ctx.status = 400
      ctx.body = { error: 'invalid-file-type', ...metadata }
      return
    }

    const storageKey = `${GUIDE_STORAGE_PREFIX}${ctx.params.id}/${randomUUID()}.${extension}`

    const uploadResult = await fileStorageAdapter.uploadFile(
      storageKey,
      buffer,
      contentType
    )
    if (!uploadResult.ok) {
      if (uploadResult.err === 'bad_request') {
        ctx.status = 400
        ctx.body = { error: 'invalid-file-data', ...metadata }
        return
      }
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
      if (imageResult.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { ...upstreamErrorBody(imageResult.upstream), ...metadata }
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

    const content: guides.GuideImageUploadResponse = {
      image: await withImageUrl(imageResult.data.image),
      guideUpdatedAt: imageResult.data.guideUpdatedAt,
    }
    ctx.status = 200
    ctx.body = { content, ...metadata }
  })

  /**
   * @swagger
   * /guides/{id}/images/{imageId}:
   *   delete:
   *     summary: Delete a guide step image
   *     description: Requires the guides-admin role. Removes the image row and the stored file. The delete bumps the guide's updatedAt; the new value is returned as guideUpdatedAt and must be sent as expectedUpdatedAt on the next save.
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
   *         description: Image deleted, with the guide's new updatedAt
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/GuideImageDeleteResponse'
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

    if (!isUuidParam(ctx.params.id) || !isUuidParam(ctx.params.imageId)) {
      ctx.status = 404
      ctx.body = { reason: 'Image not found', ...metadata }
      return
    }

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

    const content: guides.GuideImageDeleteResponse = {
      deleted: true,
      guideUpdatedAt: result.data.guideUpdatedAt,
    }
    ctx.status = 200
    ctx.body = { content, ...metadata }
  })
}
