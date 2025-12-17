/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import { deleteFile } from '../adapters/minio-adapter'
import {
  createMulterUpload,
  generateFileName,
  uploadAndSaveMetadata,
  addPresignedUrls,
} from '../utils/file-upload'
import {
  getComponentByMaintenanceUnitCode,
  getComponentsByRoomId,
  getComponentModelDocuments,
  addComponentModelDocument,
  removeComponentModelDocument,
  getComponentFiles,
  addComponentFile,
  removeComponentFile,
} from '../adapters/component-adapter'
import {
  componentsQueryParamsSchema,
  ComponentSchema,
} from '../types/component'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Components
 *     description: Operations related to components
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Gets a list of components for a maintenance unit
   *     description: |
   *       Retrieves all components associated with a specific maintenance unit code.
   *       Components are returned ordered by installation date (newest first).
   *       Each component includes details about its type, category, manufacturer,
   *       and associated maintenance unit information.
   *     tags:
   *       - Components
   *     parameters:
   *       - in: query
   *         name: maintenanceUnit
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique code identifying the maintenance unit.
   *     responses:
   *       200:
   *         description: |
   *           Successfully retrieved the components list. Returns an array of component objects
   *           containing details like ID, code, name, manufacturer, installation date, etc.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Component'
   *       400:
   *         description: Invalid maintenance unit code provided
   *       404:
   *         description: No components found for the specified maintenance unit
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/components',
    parseRequest({
      query: z
        .object({
          residenceCode: z.string(),
        })
        .or(
          z.object({
            maintenanceUnit: z.string(),
          })
        ),
    }),
    async (ctx) => {
      // Add default type=residence if residenceCode is provided
      const queryWithType =
        'residenceCode' in ctx.request.parsedQuery
          ? { ...ctx.request.parsedQuery, type: 'residence' }
          : { ...ctx.request.parsedQuery, type: 'maintenance' }

      const queryParams = componentsQueryParamsSchema.parse(queryWithType)

      const metadata = generateRouteMetadata(ctx)

      try {
        let components
        if (queryParams.type === 'maintenance') {
          components = await getComponentByMaintenanceUnitCode(
            queryParams.maintenanceUnit
          )
        } else {
          components = await getComponentByMaintenanceUnitCode(
            queryParams.residenceCode
          ) // TODO: Implement getComponentByResidenceCode
        }

        if (!components) {
          ctx.status = 404
          return
        }

        ctx.body = {
          content: ComponentSchema.array().parse(components),
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/by-room/{roomId}:
   *   get:
   *     summary: Gets a list of components for a room
   *     description: |
   *       Retrieves all components associated with a specific room ID.
   *       Components are returned ordered by installation date (newest first).
   *     tags:
   *       - Components
   *     parameters:
   *       - in: path
   *         name: roomId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the room
   *     responses:
   *       200:
   *         description: Successfully retrieved the components list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Component'
   *       404:
   *         description: Room not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/components/by-room/:roomId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Validate roomId is at most 15 characters
    const roomIdValidation = z.string().max(15).safeParse(ctx.params.roomId)
    if (!roomIdValidation.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Room ID must be at most 15 characters (Xpand format)',
        ...metadata,
      }
      return
    }

    const roomId = roomIdValidation.data

    try {
      const components = await getComponentsByRoomId(roomId)

      if (components === null) {
        ctx.status = 404
        ctx.body = { reason: 'Room not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentSchema.omit({ maintenanceUnits: true })
          .array()
          .parse(components),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  // ==================== FILE UPLOAD ROUTES ====================

  // Configure multer for image uploads (components)
  const imageUpload = createMulterUpload({
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    errorMessage:
      'Endast JPEG-, PNG- och WebP-bilder är tillåtna. Max storlek är 50MB.',
  })

  // Configure multer for document uploads (component models)
  // Note: Only PDFs are supported for documents. Word/Excel files should be converted to PDF before upload.
  const documentUpload = createMulterUpload({
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['application/pdf'],
    errorMessage:
      'Endast PDF-filer är tillåtna. Konvertera Word- eller Excel-dokument till PDF innan uppladdning.',
  })

  /**
   * @swagger
   * /component-models/{id}/upload:
   *   post:
   *     summary: Upload a document to a component model
   *     tags: [Component Models]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component model ID
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: PDF document file (max 50MB)
   *             required:
   *               - file
   *     responses:
   *       200:
   *         description: Document uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModelDocument'
   *       400:
   *         description: Invalid file type or size
   *       500:
   *         description: Upload failed
   */
  router.post(
    '(.*)/component-models/:id/upload',
    documentUpload.single('file'),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const metadata = generateRouteMetadata(ctx)

      try {
        const file = ctx.file
        if (!file) {
          ctx.status = 400
          ctx.body = { error: 'Ingen fil uppladdad', ...metadata }
          return
        }

        // Explicit PDF validation (defense in depth)
        if (file.mimetype !== 'application/pdf') {
          ctx.status = 400
          ctx.body = {
            error:
              'Endast PDF-filer är tillåtna för komponentmodellsdokumentation',
            ...metadata,
          }
          return
        }

        // Explicit file size validation (defense in depth)
        const maxSize = 50 * 1024 * 1024 // 50MB
        if (file.size > maxSize) {
          ctx.status = 400
          ctx.body = {
            error: `Filen är för stor. Max storlek är ${Math.round(maxSize / 1024 / 1024)}MB`,
            ...metadata,
          }
          return
        }

        // Validate file extension matches PDF
        const extension = file.originalname.split('.').pop()?.toLowerCase()
        if (extension !== 'pdf') {
          ctx.status = 400
          ctx.body = {
            error: 'Filtillägget måste vara .pdf',
            ...metadata,
          }
          return
        }

        // Generate unique filename
        const fileName = generateFileName({
          entityType: 'component-model',
          entityId: id,
          originalName: file.originalname,
        })

        // Upload to MinIO and save metadata to database
        const document = await uploadAndSaveMetadata({
          file,
          fileName,
          metadataHandler: async (fileId, sanitizedFile) => {
            await addComponentModelDocument(
              id,
              fileId
            )
            return { fileId, originalName: sanitizedFile.originalname }
          },
        })

        ctx.body = {
          content: document,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /component-models/{id}/documents:
   *   get:
   *     summary: Get all documents for a component model with presigned URLs
   *     tags: [Component Models]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component model ID
   *     responses:
   *       200:
   *         description: List of documents with download URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModelDocumentsResponse'
   *       404:
   *         description: Component model not found
   *       500:
   *         description: Failed to retrieve documents
   */
  router.get('(.*)/component-models/:id/documents', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const documents = await getComponentModelDocuments(id)

      // Generate presigned URLs for each document (24 hour expiry)
      const documentsWithUrls = await addPresignedUrls(documents, 86400)

      ctx.body = {
        content: {
          documents: documentsWithUrls,
          count: documentsWithUrls.length,
        },
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /component-models/{id}/documents/{fileId}:
   *   delete:
   *     summary: Delete a document from a component model
   *     tags: [Component Models]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: path
   *         name: fileId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Document deleted successfully
   */
  router.delete('(.*)/component-models/:id/documents/:fileId', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const fileId = z.string().parse(ctx.params.fileId)
    const metadata = generateRouteMetadata(ctx)

    try {
      // Delete from MinIO
      await deleteFile(fileId)

      // Remove from database
      await removeComponentModelDocument(id, fileId)

      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}/upload:
   *   post:
   *     summary: Upload images to a component
   *     tags: [Components New]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *       - in: query
   *         name: caption
   *         schema:
   *           type: string
   *         description: Optional image caption
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Image file (JPEG, PNG, or WebP, max 50MB)
   *             required:
   *               - file
   *     responses:
   *       200:
   *         description: Image uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentFile'
   *       400:
   *         description: Invalid file type or size
   *       500:
   *         description: Upload failed
   */
  router.post(
    '(.*)/components/:id/upload',
    imageUpload.single('file'),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const metadata = generateRouteMetadata(ctx)

      try {
        const file = ctx.file
        if (!file) {
          ctx.status = 400
          ctx.body = { error: 'Ingen fil uppladdad', ...metadata }
          return
        }

        // Explicit image type validation (defense in depth)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedMimeTypes.includes(file.mimetype)) {
          ctx.status = 400
          ctx.body = {
            error: 'Endast JPEG-, PNG- och WebP-bilder är tillåtna',
            ...metadata,
          }
          return
        }

        // Explicit file size validation (defense in depth)
        const maxSize = 50 * 1024 * 1024 // 50MB
        if (file.size > maxSize) {
          ctx.status = 400
          ctx.body = {
            error: `Bilden är för stor. Max storlek är ${Math.round(maxSize / 1024 / 1024)}MB`,
            ...metadata,
          }
          return
        }

        // Validate file extension matches image type
        const extension = file.originalname.split('.').pop()?.toLowerCase()
        const validExtensions = ['jpg', 'jpeg', 'png', 'webp']
        if (!extension || !validExtensions.includes(extension)) {
          ctx.status = 400
          ctx.body = {
            error: 'Filtillägget måste vara .jpg, .jpeg, .png eller .webp',
            ...metadata,
          }
          return
        }

        // Generate unique filename
        const fileName = generateFileName({
          entityType: 'component',
          entityId: id,
          originalName: file.originalname,
        })

        // Upload to MinIO and save metadata to database
        const componentFile = await uploadAndSaveMetadata({
          file,
          fileName,
          metadataHandler: async (fileId, sanitizedFile) => {
            await addComponentFile(id, fileId)
            return { fileId, originalName: sanitizedFile.originalname }
          },
        })

        ctx.body = {
          content: componentFile,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}/files:
   *   get:
   *     summary: Get all files for a component with presigned URLs
   *     tags: [Components New]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     responses:
   *       200:
   *         description: List of files with download URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentFilesResponse'
   *       404:
   *         description: Component not found
   *       500:
   *         description: Failed to retrieve files
   */
  router.get('(.*)/components/:id/files', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const files = await getComponentFiles(id)

      // Generate presigned URLs for each file (24 hour expiry)
      const filesWithUrls = await addPresignedUrls(files, 86400)

      ctx.body = {
        content: {
          files: filesWithUrls,
          count: filesWithUrls.length,
        },
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}/files/{fileId}:
   *   delete:
   *     summary: Delete a file from a component
   *     tags: [Components New]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: path
   *         name: fileId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: File deleted successfully
   */
  router.delete('(.*)/components/:id/files/:fileId', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const fileId = z.string().parse(ctx.params.fileId)
    const metadata = generateRouteMetadata(ctx)

    try {
      // Delete from MinIO
      await deleteFile(fileId)

      // Remove from database
      await removeComponentFile(id, fileId)

      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
