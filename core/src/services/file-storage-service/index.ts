import path from 'path'
import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { registerSchema } from '../../utils/openapi'
import { fileStorageSchemas } from '@onecore/types'

import * as fileStorageAdapter from '../../adapters/file-storage-adapter'
import { GUIDE_STORAGE_PREFIX } from '../guides-service/constants'
import { LEASE_EXPORT_STORAGE_PREFIX } from '../lease-service/lease-exports/constants'

// Guide images are created, read and removed through /guides, which keeps the
// metadata rows in the communication service in sync and hides draft images
// from readers. Lease exports are stored per user and handed out only through
// /lease-exports. Reaching either through the generic file routes would leak
// or orphan them, so every /files route refuses them.
//
// Storage backends map several spellings onto the same object key: SeaweedFS
// turns backslashes into slashes and collapses leading slashes, and "./" or
// ".." segments may be resolved as well. The key is normalized the same way
// before the prefix check so the guard does not depend on the backend.
const normalizeKey = (key: string) =>
  path.posix.normalize(key.replace(/\\/g, '/')).replace(/^\/+/, '')

export const isGuideKey = (key: string) =>
  normalizeKey(key).startsWith(GUIDE_STORAGE_PREFIX)

export const isLeaseExportKey = (key: string): boolean =>
  normalizeKey(key).startsWith(LEASE_EXPORT_STORAGE_PREFIX)

const GUIDE_KEY_REFUSAL = { error: 'guide-files-managed-via-guides-api' }
const LEASE_EXPORT_KEY_REFUSAL = {
  error: 'lease-export-files-managed-via-lease-exports-api',
}

const isProtectedKey = (key: string) => isGuideKey(key) || isLeaseExportKey(key)

const asStrings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === 'string'
  )

// Runs before every /files handler and checks each place a key can arrive:
// the :fileName path param, the list prefix and the upload body.
const refuseProtectedKeys: KoaRouter.Middleware = async (ctx, next) => {
  const body: unknown = ctx.request.body
  const keys = [
    ...asStrings(ctx.params.fileName),
    ...asStrings(ctx.query.prefix),
    ...(typeof body === 'object' && body !== null && 'fileName' in body
      ? asStrings(body.fileName)
      : []),
  ]
  if (keys.some(isGuideKey)) {
    ctx.status = 403
    ctx.body = GUIDE_KEY_REFUSAL
    return
  }
  if (keys.some(isLeaseExportKey)) {
    ctx.status = 403
    ctx.body = LEASE_EXPORT_KEY_REFUSAL
    return
  }
  await next()
}

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
  // Register all schemas for OpenAPI documentation
  registerSchema('FileListItem', fileStorageSchemas.FileListItemSchema)
  registerSchema('FileMetadata', fileStorageSchemas.FileMetadataSchema)
  registerSchema(
    'FileUploadRequest',
    fileStorageSchemas.FileUploadRequestSchema
  )
  registerSchema(
    'FileUploadResponse',
    fileStorageSchemas.FileUploadResponseSchema
  )
  registerSchema('FileUrlResponse', fileStorageSchemas.FileUrlResponseSchema)
  registerSchema(
    'FileExistsResponse',
    fileStorageSchemas.FileExistsResponseSchema
  )
  registerSchema(
    'ListFilesResponse',
    fileStorageSchemas.ListFilesResponseSchema
  )
  registerSchema('ListFilesQuery', fileStorageSchemas.ListFilesQuerySchema)
  registerSchema('FileUrlQuery', fileStorageSchemas.FileUrlQuerySchema)

  /**
   * @swagger
   * /files:
   *   get:
   *     summary: List files with optional prefix
   *     tags:
   *       - File Storage
   *     parameters:
   *       - in: query
   *         name: prefix
   *         schema:
   *           type: string
   *           description: Filter files by prefix
   *         required: false
   *     responses:
   *       200:
   *         description: List of files with metadata
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListFilesResponse'
   *       400:
   *         description: Invalid query parameters
   *       403:
   *         description: Guide image or lease export prefix — use the /guides or /lease-exports routes. Both are also omitted from every other listing.
   *       500:
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/files', refuseProtectedKeys, async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Validate query parameters
    const queryResult = fileStorageSchemas.ListFilesQuerySchema.safeParse(
      ctx.query
    )
    if (!queryResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        details: queryResult.error.errors,
      }
      return
    }

    const { prefix } = queryResult.data

    const result = await fileStorageAdapter.listFiles(prefix)

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: result.err }
      return
    }

    // A prefix outside the protected ones can still match their keys (no
    // prefix at all, or a partial one such as "g"), so they are filtered out.
    const files = result.data.filter((file) => !isProtectedKey(file.name))

    ctx.status = 200
    ctx.body = makeSuccessResponseBody({ files }, metadata)
  })

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
   *             $ref: '#/components/schemas/FileUploadRequest'
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/FileUploadResponse'
   *       400:
   *         description: Invalid request
   *       403:
   *         description: Guide image or lease export key — use the /guides or /lease-exports routes
   *       500:
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/files/upload', refuseProtectedKeys, async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Validate request body
    const bodyResult = fileStorageSchemas.FileUploadRequestSchema.safeParse(
      ctx.request.body
    )
    if (!bodyResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        details: bodyResult.error.errors,
      }
      return
    }

    const { fileName, fileData, contentType } = bodyResult.data

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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/FileUrlResponse'
   *       400:
   *         description: Invalid query parameters
   *       403:
   *         description: Guide image or lease export — use the /guides or /lease-exports routes
   *       404:
   *         description: File not found
   *       500:
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/files/:fileName/url', refuseProtectedKeys, async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { fileName } = ctx.params

    // Validate query parameters
    const queryResult = fileStorageSchemas.FileUrlQuerySchema.safeParse(
      ctx.query
    )
    if (!queryResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        details: queryResult.error.errors,
      }
      return
    }

    const { expirySeconds } = queryResult.data
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/FileMetadata'
   *       403:
   *         description: Guide image or lease export — use the /guides or /lease-exports routes
   *       404:
   *         description: File not found
   *       500:
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '(.*)/files/:fileName/metadata',
    refuseProtectedKeys,
    async (ctx) => {
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
    }
  )

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
   *       403:
   *         description: Guide image or lease export — use the /guides or /lease-exports routes
   *       404:
   *         description: File not found
   *       500:
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/files/:fileName', refuseProtectedKeys, async (ctx) => {
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/FileExistsResponse'
   *       403:
   *         description: Guide image or lease export — use the /guides or /lease-exports routes
   *       500:
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '(.*)/files/:fileName/exists',
    refuseProtectedKeys,
    async (ctx) => {
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
    }
  )
}
