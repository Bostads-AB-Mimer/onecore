import KoaRouter from '@koa/router'
import { createDocument, deleteDocument } from '../adapters/documents-adapter'
import { prisma } from '../adapters/db'

/**
 * @swagger
 * tags:
 *   - name: Documents
 *     description: Operations for managing document metadata attached to component models and instances. File storage is handled separately via the file-storage service.
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /documents:
   *   post:
   *     summary: Create a document record
   *     description: |
   *       Creates a document metadata record linking a file (already uploaded to file-storage service)
   *       to either a component model or component instance.
   *     tags:
   *       - Documents
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fileId
   *             properties:
   *               fileId:
   *                 type: string
   *                 description: The file ID from the file-storage service
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
   *         description: Document record created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Document'
   *       400:
   *         description: |
   *           Bad request - fileId not provided or neither componentModelId nor componentInstanceId provided
   *       500:
   *         description: Internal server error
   */
  router.post('(.*)/documents', async (ctx) => {
    const { fileId, componentModelId, componentInstanceId } = ctx.request
      .body as {
      fileId?: string
      componentModelId?: string
      componentInstanceId?: string
    }

    if (!fileId) {
      ctx.status = 400
      ctx.body = { error: 'fileId is required' }
      return
    }

    if (!componentModelId && !componentInstanceId) {
      ctx.status = 400
      ctx.body = {
        error: 'Either componentModelId or componentInstanceId required',
      }
      return
    }

    const document = await createDocument({
      componentModelId,
      componentInstanceId,
      fileId,
    })

    ctx.body = document
  })

  /**
   * @swagger
   * /documents/component-models/{id}:
   *   get:
   *     summary: Get documents for a component model
   *     description: |
   *       Retrieves all document metadata attached to a specific component model.
   *       Use the fileId to fetch file content/URLs from the file-storage service.
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
   *                 $ref: '#/components/schemas/Document'
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

    ctx.body = documents
  })

  /**
   * @swagger
   * /documents/component-instances/{id}:
   *   get:
   *     summary: Get documents for a component instance
   *     description: |
   *       Retrieves all document metadata attached to a specific component instance.
   *       Use the fileId to fetch file content/URLs from the file-storage service.
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
   *                 $ref: '#/components/schemas/Document'
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

    ctx.body = documents
  })

  /**
   * @swagger
   * /documents/{id}:
   *   delete:
   *     summary: Delete a document record
   *     description: |
   *       Deletes a document metadata record. Note: The actual file should be deleted
   *       separately via the file-storage service.
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
   *         description: Document record deleted successfully (no content)
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
