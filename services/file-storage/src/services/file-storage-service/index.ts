import KoaRouter from '@koa/router'
import {
  uploadFile,
  getFile,
  getFileUrl,
  deleteFile,
  getFileMetadata,
  fileExists,
  listFiles,
} from '../../adapters/minio-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: File Storage
 *     description: Operations related to file storage
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /files:
   *   get:
   *     summary: List files with optional prefix
   *     tags:
   *       - File Storage
   *     description: Retrieves a list of files from MinIO storage, optionally filtered by prefix.
   *     parameters:
   *       - in: query
   *         name: prefix
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter files by prefix (e.g., 'documents/')
   *     responses:
   *       '200':
   *         description: Successful response with list of files
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 files:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Array of file names
   *       '500':
   *         description: Error listing files
   */
  router.get('/files', async (ctx) => {
    try {
      const prefix = (ctx.query.prefix as string) || ''
      const files = await listFiles(prefix)
      ctx.body = { files }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * @swagger
   * /files/upload:
   *   post:
   *     summary: Upload a file
   *     tags:
   *       - File Storage
   *     description: Uploads a file to MinIO storage.
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
   *                 description: Name of the file
   *               fileData:
   *                 type: string
   *                 description: Base64 encoded file data
   *               contentType:
   *                 type: string
   *                 description: MIME type of the file
   *     responses:
   *       '200':
   *         description: File uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 fileName:
   *                   type: string
   *                   description: The stored file name
   *                 message:
   *                   type: string
   *       '400':
   *         description: Invalid request body
   *       '500':
   *         description: Error uploading file
   */
  router.post('/files/upload', async (ctx) => {
    try {
      const { fileName, fileData, contentType } = ctx.request.body as {
        fileName: string
        fileData: string
        contentType: string
      }

      if (!fileName || !fileData || !contentType) {
        ctx.status = 400
        ctx.body = { error: 'fileName, fileData, and contentType are required' }
        return
      }

      // Convert base64 to buffer
      const fileBuffer = Buffer.from(fileData, 'base64')
      const storedFileName = await uploadFile(fileName, fileBuffer, contentType)

      ctx.body = {
        fileName: storedFileName,
        message: 'File uploaded successfully',
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * @swagger
   * /files/{fileName}:
   *   get:
   *     summary: Download a file
   *     tags:
   *       - File Storage
   *     description: Downloads a file from MinIO storage as a stream.
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file to download
   *     responses:
   *       '200':
   *         description: File stream
   *       '404':
   *         description: File not found
   *       '500':
   *         description: Error downloading file
   */
  router.get('/files/:fileName', async (ctx) => {
    try {
      const { fileName } = ctx.params

      // Check if file exists first
      const exists = await fileExists(fileName)
      if (!exists) {
        ctx.status = 404
        ctx.body = { error: 'File not found' }
        return
      }

      const stream = await getFile(fileName)
      ctx.body = stream
      ctx.set('Content-Type', 'application/octet-stream')
      ctx.set('Content-Disposition', `attachment; filename="${fileName}"`)
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to download file',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * @swagger
   * /files/{fileName}/url:
   *   get:
   *     summary: Get presigned URL for file
   *     tags:
   *       - File Storage
   *     description: Generates a presigned URL for downloading a file.
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file
   *       - in: query
   *         name: expirySeconds
   *         required: false
   *         schema:
   *           type: number
   *           default: 3600
   *         description: URL expiry time in seconds
   *     responses:
   *       '200':
   *         description: Presigned URL generated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 url:
   *                   type: string
   *                   description: Presigned URL
   *                 expiresIn:
   *                   type: number
   *                   description: Expiry time in seconds
   *       '404':
   *         description: File not found
   *       '500':
   *         description: Error generating URL
   */
  router.get('/files/:fileName/url', async (ctx) => {
    try {
      const { fileName } = ctx.params
      const expirySeconds = parseInt(ctx.query.expirySeconds as string) || 3600

      // Check if file exists first
      const exists = await fileExists(fileName)
      if (!exists) {
        ctx.status = 404
        ctx.body = { error: 'File not found' }
        return
      }

      const url = await getFileUrl(fileName, expirySeconds)
      ctx.body = {
        url,
        expiresIn: expirySeconds,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to generate URL',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * @swagger
   * /files/{fileName}/metadata:
   *   get:
   *     summary: Get file metadata
   *     tags:
   *       - File Storage
   *     description: Retrieves metadata for a specific file.
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file
   *     responses:
   *       '200':
   *         description: File metadata
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 size:
   *                   type: number
   *                   description: File size in bytes
   *                 etag:
   *                   type: string
   *                   description: Entity tag
   *                 lastModified:
   *                   type: string
   *                   format: date-time
   *                   description: Last modified timestamp
   *       '404':
   *         description: File not found
   *       '500':
   *         description: Error retrieving metadata
   */
  router.get('/files/:fileName/metadata', async (ctx) => {
    try {
      const { fileName } = ctx.params

      // Check if file exists first
      const exists = await fileExists(fileName)
      if (!exists) {
        ctx.status = 404
        ctx.body = { error: 'File not found' }
        return
      }

      const metadata = await getFileMetadata(fileName)
      ctx.body = metadata
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to retrieve metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * @swagger
   * /files/{fileName}:
   *   delete:
   *     summary: Delete a file
   *     tags:
   *       - File Storage
   *     description: Deletes a file from MinIO storage.
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file to delete
   *     responses:
   *       '200':
   *         description: File deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       '404':
   *         description: File not found
   *       '500':
   *         description: Error deleting file
   */
  router.delete('/files/:fileName', async (ctx) => {
    try {
      const { fileName } = ctx.params

      // Check if file exists first
      const exists = await fileExists(fileName)
      if (!exists) {
        ctx.status = 404
        ctx.body = { error: 'File not found' }
        return
      }

      await deleteFile(fileName)
      ctx.body = { message: 'File deleted successfully' }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * @swagger
   * /files/{fileName}/exists:
   *   get:
   *     summary: Check if file exists
   *     tags:
   *       - File Storage
   *     description: Checks whether a file exists in MinIO storage.
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Name of the file
   *     responses:
   *       '200':
   *         description: File existence status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 exists:
   *                   type: boolean
   *                   description: Whether the file exists
   *       '500':
   *         description: Error checking file existence
   */
  router.get('/files/:fileName/exists', async (ctx) => {
    try {
      const { fileName } = ctx.params
      const exists = await fileExists(fileName)
      ctx.body = { exists }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: 'Failed to check file existence',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
