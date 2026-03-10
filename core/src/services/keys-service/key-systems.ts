import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeySystemsApi } from '../../adapters/keys-adapter'
import * as fileStorageAdapter from '../../adapters/file-storage-adapter'
import { createLogEntry, getUserName } from './helpers'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /key-systems:
   *   get:
   *     summary: List all key systems with pagination
   *     description: Retrieve a paginated list of all key systems
   *     tags: [Keys Service]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (starts from 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Number of records per page
   *     responses:
   *       200:
   *         description: Successfully retrieved paginated key systems
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/KeySystem'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.list(ctx.query)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /key-systems/search:
   *   get:
   *     summary: Search key systems
   *     description: |
   *       Search key systems with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any KeySystem field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *
   *       Examples:
   *       - `?createdAt=>2024-01-01` - Created after Jan 1, 2024
   *       - `?manufacturer=assa&createdAt=<2024-12-31` - Manufacturer contains "assa" AND created before Dec 31, 2024
   *     tags: [Keys Service]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (starts from 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Number of records per page
   *       - in: query
   *         name: q
   *         required: false
   *         schema:
   *           type: string
   *           minLength: 3
   *         description: Search query for OR search across fields specified in 'fields' parameter
   *       - in: query
   *         name: fields
   *         required: false
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields for OR search (e.g., "systemCode,manufacturer"). Defaults to systemCode.
   *       - in: query
   *         name: id
   *         schema:
   *           type: string
   *       - in: query
   *         name: systemCode
   *         schema:
   *           type: string
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *       - in: query
   *         name: manufacturer
   *         schema:
   *           type: string
   *       - in: query
   *         name: managingSupplier
   *         schema:
   *           type: string
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *       - in: query
   *         name: propertyIds
   *         schema:
   *           type: string
   *       - in: query
   *         name: installationDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: string
   *       - in: query
   *         name: notes
   *         schema:
   *           type: string
   *       - in: query
   *         name: createdAt
   *         schema:
   *           type: string
   *       - in: query
   *         name: updatedAt
   *         schema:
   *           type: string
   *       - in: query
   *         name: createdBy
   *         schema:
   *           type: string
   *       - in: query
   *         name: updatedBy
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successfully retrieved paginated search results
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Bad request. Invalid parameters or field names
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
  router.get('/key-systems/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeySystemsApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   get:
   *     summary: Get key system by ID
   *     description: Retrieve a specific key system by its ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system
   *     responses:
   *       200:
   *         description: Successfully retrieved key system
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeySystem'
   *       404:
   *         description: Key system not found
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
  router.get('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems:
   *   post:
   *     summary: Create a new key system
   *     description: Create a new key system
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeySystemRequest'
   *     responses:
   *       201:
   *         description: Key system created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Invalid type or duplicate system code
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
  router.post('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeySystemsApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'A key system with this code already exists',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'keySystem',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Skapad',
    })

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   patch:
   *     summary: Update a key system
   *     description: Partially update a key system
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeySystemRequest'
   *     responses:
   *       200:
   *         description: Key system updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Invalid type or duplicate system code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Key system not found
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
  router.put('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeySystemsApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'A key system with this code already exists',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keySystem',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Uppdaterad',
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   delete:
   *     summary: Delete a key system
   *     description: Delete a key system by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system to delete
   *     responses:
   *       200:
   *         description: Key system deleted successfully
   *       404:
   *         description: Key system not found
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
  router.delete('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const getResult = await KeySystemsApi.get(ctx.params.id)
    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key system before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const result = await KeySystemsApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'delete',
      objectType: 'keySystem',
      objectId: ctx.params.id,
      autoGenerateDescription: true,
      entityData: getResult.data,
      action: 'Raderad',
    })

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== SCHEMA FILE ROUTES (orchestration) ====================

  /**
   * @swagger
   * /key-systems/{id}/upload-schema:
   *   post:
   *     summary: Upload a schema file for a key system
   *     tags: [Keys Service]
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
   *             type: object
   *             required: [fileData]
   *             properties:
   *               fileData:
   *                 type: string
   *                 description: Base64 encoded file data
   *               fileContentType:
   *                 type: string
   *               fileName:
   *                 type: string
   *     responses:
   *       200:
   *         description: Schema file uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     fileId:
   *                       type: string
   *       400:
   *         description: Missing fileData
   *       404:
   *         description: Key system not found
   *       500:
   *         description: Internal server error
   */
  router.post('/key-systems/:id/upload-schema', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { fileData, fileContentType, fileName } = ctx.request.body as {
      fileData?: string
      fileContentType?: string
      fileName?: string
    }

    if (!fileData) {
      ctx.status = 400
      ctx.body = { error: 'Missing fileData in request body', ...metadata }
      return
    }

    // Verify key system exists and get current schemaFileId
    const keySystemResult = await KeySystemsApi.get(ctx.params.id)
    if (!keySystemResult.ok) {
      if (keySystemResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      logger.error(
        { err: keySystemResult.err, metadata },
        'Error fetching key system for schema upload'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keySystem = keySystemResult.data

    // Delete old schema file if one exists
    if (keySystem.schemaFileId) {
      const deleteResult = await fileStorageAdapter.deleteFile(
        keySystem.schemaFileId
      )
      if (!deleteResult.ok && deleteResult.err !== 'not_found') {
        logger.error(
          { err: deleteResult.err, fileId: keySystem.schemaFileId, metadata },
          'Error deleting old schema file'
        )
      }
    }

    // Convert base64 to buffer and upload
    const fileBuffer = Buffer.from(fileData, 'base64')
    const contentType = fileContentType || 'application/pdf'
    const originalFileName = fileName || 'schema.pdf'
    const storageFileName = `key-system-${ctx.params.id}-schema-${Date.now()}-${originalFileName}`

    const uploadResult = await fileStorageAdapter.uploadFile(
      storageFileName,
      fileBuffer,
      contentType
    )

    if (!uploadResult.ok) {
      logger.error(
        { err: uploadResult.err, metadata },
        'Error uploading schema file to storage'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const fileId = uploadResult.data.fileName

    // Update key system with new schemaFileId
    const updateResult = await KeySystemsApi.update(ctx.params.id, {
      schemaFileId: fileId,
    })

    if (!updateResult.ok) {
      // Compensate: delete the uploaded file
      await fileStorageAdapter.deleteFile(fileId)
      logger.error(
        { err: updateResult.err, metadata },
        'Error updating key system with new schemaFileId, compensating'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keySystem',
      objectId: ctx.params.id,
      description: `Schema uppladdad för ${keySystem.systemCode}: ${originalFileName}`,
    })

    ctx.status = 200
    ctx.body = { content: { fileId }, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}/download-schema:
   *   get:
   *     summary: Get presigned download URL for a key system schema file
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Presigned download URL
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SchemaDownloadUrlResponse'
   *       404:
   *         description: Key system or schema file not found
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems/:id/download-schema', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const keySystemResult = await KeySystemsApi.get(ctx.params.id)
    if (!keySystemResult.ok) {
      if (keySystemResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          reason: 'Key system or schema file not found',
          ...metadata,
        }
        return
      }
      logger.error(
        { err: keySystemResult.err, metadata },
        'Error fetching key system for schema download'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keySystem = keySystemResult.data

    if (!keySystem.schemaFileId) {
      ctx.status = 404
      ctx.body = {
        reason: 'Key system or schema file not found',
        ...metadata,
      }
      return
    }

    const urlResult = await fileStorageAdapter.getFileUrl(
      keySystem.schemaFileId
    )

    if (!urlResult.ok) {
      if (urlResult.err === 'not_found') {
        ctx.status = 404
        ctx.body = {
          reason: 'Key system or schema file not found',
          ...metadata,
        }
        return
      }
      logger.error(
        { err: urlResult.err, metadata },
        'Error generating schema download URL'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: urlResult.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}/schema:
   *   delete:
   *     summary: Delete the schema file for a key system
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Schema deleted successfully
   *       404:
   *         description: Key system not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/key-systems/:id/schema', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const keySystemResult = await KeySystemsApi.get(ctx.params.id)
    if (!keySystemResult.ok) {
      if (keySystemResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      logger.error(
        { err: keySystemResult.err, metadata },
        'Error fetching key system before schema deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keySystem = keySystemResult.data

    if (keySystem.schemaFileId) {
      const deleteResult = await fileStorageAdapter.deleteFile(
        keySystem.schemaFileId
      )
      if (!deleteResult.ok && deleteResult.err !== 'not_found') {
        logger.error(
          { err: deleteResult.err, fileId: keySystem.schemaFileId, metadata },
          'Error deleting schema file from storage'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }

    // Clear the schemaFileId on the key system
    const updateResult = await KeySystemsApi.update(ctx.params.id, {
      schemaFileId: null,
    })

    if (!updateResult.ok) {
      logger.error(
        { err: updateResult.err, metadata },
        'Error clearing schemaFileId on key system'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keySystem',
      objectId: ctx.params.id,
      description: `Schema raderad för ${keySystem.systemCode}`,
    })

    ctx.status = 204
  })
}
