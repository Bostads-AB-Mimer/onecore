import KoaRouter from '@koa/router'
import {
  createDocument,
  deleteDocument,
  getDocumentsWithMetadata,
} from '../adapters/documents-adapter'
import { uploadFile, getFileUrl } from '../adapters/minio-adapter'
import { createMulterUpload, generateFileName } from '../utils/file-upload'
import { prisma } from '../adapters/db'

/**
 * @swagger
 * tags:
 *   - name: Documents
 *     description: Operations for managing documents attached to component models and instances
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /documents/upload:
   *   post:
   *     summary: Upload a document
   *     description: |
   *       Uploads a document (PDF or image) and attaches it to either a component model or component instance.
   *       Maximum file size is 50MB. Supported formats: PDF, JPEG, PNG, WebP.
   *     tags:
   *       - Documents
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: The file to upload (PDF, JPEG, PNG, or WebP)
   *               componentModelId:
   *                 type: string
   *                 format: uuid
   *                 description: The ID of the component model to attach the document to (required if componentInstanceId not provided)
   *               componentInstanceId:
   *                 type: string
   *                 format: uuid
   *                 description: The ID of the component instance to attach the document to (required if componentModelId not provided)
   *     responses:
   *       200:
   *         description: Document uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Document'
   *       400:
   *         description: |
   *           Bad request - either no file provided, neither componentModelId nor componentInstanceId provided,
   *           file size exceeds limit, or unsupported file type
   *       500:
   *         description: Internal server error
   */
  router.post('(.*)/documents/upload', async (ctx) => {
    const upload = createMulterUpload({
      maxSizeBytes: 50 * 1024 * 1024,
      allowedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
    })

    await upload.single('file')(ctx, async () => {
      const file = ctx.file
      if (!file) {
        ctx.status = 400
        ctx.body = { error: 'No file provided' }
        return
      }

      const { componentModelId, componentInstanceId } = ctx.request.body as {
        componentModelId?: string
        componentInstanceId?: string
      }

      if (!componentModelId && !componentInstanceId) {
        ctx.status = 400
        ctx.body = {
          error: 'Either componentModelId or componentInstanceId required',
        }
        return
      }

      const entityType = componentModelId
        ? 'component-model'
        : 'component-instance'
      const entityId = componentModelId || componentInstanceId!
      const fileName = generateFileName({
        entityType,
        entityId,
        originalName: file.originalname,
      })

      await uploadFile(fileName, file.buffer, file.mimetype, file.originalname)

      const document = await createDocument({
        componentModelId,
        componentInstanceId,
        fileId: fileName,
      })

      ctx.body = document
    })
  })

  /**
   * @swagger
   * /documents/component-models/{id}:
   *   get:
   *     summary: Get documents for a component model
   *     description: |
   *       Retrieves all documents attached to a specific component model, including presigned URLs
   *       for accessing the files. URLs are valid for 24 hours.
   *     tags:
   *       - Documents
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The component model ID
   *     responses:
   *       200:
   *         description: Successfully retrieved documents
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DocumentWithUrl'
   *       404:
   *         description: Component model not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/documents/component-models/:id', async (ctx) => {
    const documents = await prisma.componentModels
      .findUnique({
        where: { id: ctx.params.id },
        include: { documents: true },
      })
      .then((model) => model?.documents || [])

    const withMetadata = await getDocumentsWithMetadata(documents)

    const withUrls = await Promise.all(
      withMetadata.map(async (doc) => ({
        ...doc,
        url: await getFileUrl(doc.fileId, 86400),
      }))
    )

    ctx.body = withUrls
  })

  /**
   * @swagger
   * /documents/component-instances/{id}:
   *   get:
   *     summary: Get documents for a component instance
   *     description: |
   *       Retrieves all documents attached to a specific component instance, including presigned URLs
   *       for accessing the files. URLs are valid for 24 hours.
   *     tags:
   *       - Documents
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The component instance ID
   *     responses:
   *       200:
   *         description: Successfully retrieved documents
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DocumentWithUrl'
   *       404:
   *         description: Component instance not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/documents/component-instances/:id', async (ctx) => {
    const documents = await prisma.components
      .findUnique({
        where: { id: ctx.params.id },
        include: { documents: true },
      })
      .then((comp) => comp?.documents || [])

    const withMetadata = await getDocumentsWithMetadata(documents)

    const withUrls = await Promise.all(
      withMetadata.map(async (doc) => ({
        ...doc,
        url: await getFileUrl(doc.fileId, 86400),
      }))
    )

    ctx.body = withUrls
  })

  /**
   * @swagger
   * /documents/{id}:
   *   delete:
   *     summary: Delete a document
   *     description: |
   *       Deletes a document and its associated file from storage. This action cannot be undone.
   *     tags:
   *       - Documents
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The document ID to delete
   *     responses:
   *       204:
   *         description: Document deleted successfully (no content)
   *       404:
   *         description: Document not found
   *       500:
   *         description: Internal server error
   */
  router.delete('(.*)/documents/:id', async (ctx) => {
    await deleteDocument(ctx.params.id)
    ctx.status = 204
  })
}
