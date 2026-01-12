import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import * as fileStorageAdapter from '../../adapters/file-storage-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: File Storage
 *     description: Operations related to file storage
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /files/upload:
   *   post:
   *     summary: Upload a file
   *     tags:
   *       - File Storage
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fileName
   *               - fileData
   *               - contentType
   *             properties:
   *               fileName:
   *                 type: string
   *                 description: Name for the file
   *               fileData:
   *                 type: string
   *                 description: Base64 encoded file data
   *               contentType:
   *                 type: string
   *                 description: MIME type of the file
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Server error
   */
  router.post('/files/upload', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { fileName, fileData, contentType } = ctx.request.body as {
      fileName?: string
      fileData?: string
      contentType?: string
    }

    if (!fileName || !fileData || !contentType) {
      ctx.status = 400
      ctx.body = { error: 'fileName, fileData, and contentType are required' }
      return
    }

    const fileBuffer = Buffer.from(fileData, 'base64')
    const result = await fileStorageAdapter.uploadFile(
      fileName,
      fileBuffer,
      contentType
    )

    if (!result.ok) {
      ctx.status = result.err === 'bad_request' ? 400 : 500
      ctx.body = { error: result.err }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(result.data, metadata)
  })

  /**
   * @swagger
   * /files/{fileName}/url:
   *   get:
   *     summary: Get presigned URL for file download
   *     tags:
   *       - File Storage
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file
   *       - in: query
   *         name: expirySeconds
   *         schema:
   *           type: number
   *           default: 3600
   *         description: URL expiry time in seconds
   *     responses:
   *       200:
   *         description: Presigned URL generated
   *       404:
   *         description: File not found
   *       500:
   *         description: Server error
   */
  router.get('/files/:fileName/url', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { fileName } = ctx.params
    const expirySeconds = parseInt(ctx.query.expirySeconds as string) || 3600

    const result = await fileStorageAdapter.getFileUrl(fileName, expirySeconds)

    if (!result.ok) {
      ctx.status = result.err === 'not_found' ? 404 : 500
      ctx.body = { error: result.err }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(result.data, metadata)
  })

  /**
   * @swagger
   * /files/{fileName}/metadata:
   *   get:
   *     summary: Get file metadata
   *     tags:
   *       - File Storage
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file
   *     responses:
   *       200:
   *         description: File metadata
   *       404:
   *         description: File not found
   *       500:
   *         description: Server error
   */
  router.get('/files/:fileName/metadata', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { fileName } = ctx.params

    const result = await fileStorageAdapter.getFileMetadata(fileName)

    if (!result.ok) {
      ctx.status = result.err === 'not_found' ? 404 : 500
      ctx.body = { error: result.err }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(result.data, metadata)
  })

  /**
   * @swagger
   * /files/{fileName}:
   *   delete:
   *     summary: Delete a file
   *     tags:
   *       - File Storage
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file to delete
   *     responses:
   *       204:
   *         description: File deleted successfully
   *       404:
   *         description: File not found
   *       500:
   *         description: Server error
   */
  router.delete('/files/:fileName', async (ctx) => {
    const { fileName } = ctx.params

    const result = await fileStorageAdapter.deleteFile(fileName)

    if (!result.ok) {
      ctx.status = result.err === 'not_found' ? 404 : 500
      ctx.body = { error: result.err }
      return
    }

    ctx.status = 204
  })

  /**
   * @swagger
   * /files/{fileName}/exists:
   *   get:
   *     summary: Check if file exists
   *     tags:
   *       - File Storage
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file
   *     responses:
   *       200:
   *         description: File existence status
   *       500:
   *         description: Server error
   */
  router.get('/files/:fileName/exists', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { fileName } = ctx.params

    const result = await fileStorageAdapter.fileExists(fileName)

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: result.err }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody({ exists: result.data }, metadata)
  })
}
