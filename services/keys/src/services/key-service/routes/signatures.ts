import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { keys } from '@onecore/types'
import * as signaturesAdapter from '../adapters/signatures-adapter'
import * as receiptsAdapter from '../adapters/receipts-adapter'
import * as simpleSignApi from '../adapters/simplesign-adapter'
import * as signatureWebhookService from '../signature-webhook-service'
import Config from '../../../common/config'

const {
  SignatureSchema,
  CreateSignatureRequestSchema,
  SendSignatureRequestSchema,
  SimpleSignWebhookPayloadSchema,
} = keys

type SendSignatureRequest = keys.SendSignatureRequest
type SimpleSignWebhookPayload = keys.SimpleSignWebhookPayload

const IdParamSchema = z.object({ id: z.string().uuid() })

export const routes = (router: KoaRouter) => {
  registerSchema('Signature', SignatureSchema)
  registerSchema('CreateSignatureRequest', CreateSignatureRequestSchema)
  registerSchema('SendSignatureRequest', SendSignatureRequestSchema)
  registerSchema('SimpleSignWebhookPayload', SimpleSignWebhookPayloadSchema)

  /**
   * @swagger
   * /signatures/send:
   *   post:
   *     summary: Send a document for digital signature via SimpleSign
   *     tags: [Signatures]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SendSignatureRequest'
   *     responses:
   *       201:
   *         description: Signature request sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Signature'
   *       404:
   *         description: Resource not found
   */
  router.post(
    '/signatures/send',
    parseRequestBody(SendSignatureRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: SendSignatureRequest = ctx.request.body

        // Validate that the resource exists (e.g., receipt)
        if (payload.resourceType === 'receipt') {
          const receipt = await receiptsAdapter.getReceiptById(
            payload.resourceId,
            db
          )
          if (!receipt) {
            ctx.status = 404
            ctx.body = {
              reason: 'Receipt not found',
              ...metadata,
            }
            return
          }
        }

        // Send PDF to SimpleSign
        const simpleSignResponse = await simpleSignApi.sendPdfForSignature({
          pdfBase64: payload.pdfBase64,
          recipientEmail: payload.recipientEmail,
          recipientName: payload.recipientName,
        })

        // Create signature record
        const signature = await signaturesAdapter.createSignature(
          {
            resourceType: payload.resourceType,
            resourceId: payload.resourceId,
            simpleSignDocumentId: simpleSignResponse.id,
            recipientEmail: payload.recipientEmail,
            recipientName: payload.recipientName || null,
            status: 'sent',
          },
          db
        )

        ctx.status = 201
        ctx.body = { content: signature, ...metadata }
      } catch (err: any) {
        logger.error(err, 'Error sending signature request')
        ctx.status = 500
        ctx.body = {
          error: 'Failed to send signature request',
          reason: err.message,
          ...metadata,
        }
      }
    }
  )

  /**
   * @swagger
   * /signatures/{id}:
   *   get:
   *     summary: Get a signature by ID
   *     tags: [Signatures]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Signature details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Signature'
   *       404:
   *         description: Signature not found
   */
  router.get('/signatures/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid signature id', ...metadata }
        return
      }

      const signature = await signaturesAdapter.getSignatureById(
        parse.data.id,
        db
      )
      if (!signature) {
        ctx.status = 404
        ctx.body = { reason: 'Signature not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: signature, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching signature')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /signatures/resource/{resourceType}/{resourceId}:
   *   get:
   *     summary: Get all signatures for a resource
   *     tags: [Signatures]
   *     parameters:
   *       - in: path
   *         name: resourceType
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: resourceId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: List of signatures
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Signature'
   */
  router.get('/signatures/resource/:resourceType/:resourceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const { resourceType, resourceId } = ctx.params

      const signatures = await signaturesAdapter.getSignaturesByResourceId(
        resourceType,
        resourceId,
        db
      )

      ctx.status = 200
      ctx.body = { content: signatures, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching signatures')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /webhooks/simplesign:
   *   post:
   *     summary: Webhook endpoint for SimpleSign status updates
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SimpleSignWebhookPayload'
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       404:
   *         description: Signature not found
   */
  router.post('/webhooks/simplesign', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      // Validate webhook secret
      const webhookSecret = ctx.get('webhookSecret')
      if (
        Config.simpleSign.webhookSecret &&
        webhookSecret !== Config.simpleSign.webhookSecret
      ) {
        logger.warn(
          { providedSecret: webhookSecret ? 'provided' : 'missing' },
          'Invalid webhook secret'
        )
        ctx.status = 401
        ctx.body = { reason: 'Unauthorized', ...metadata }
        return
      }

      const webhookPayload = ctx.request.body as SimpleSignWebhookPayload

      logger.info(
        { documentId: webhookPayload.id, status: webhookPayload.status },
        'SimpleSign webhook received'
      )

      // Process webhook using service layer
      const result = await signatureWebhookService.processSignatureWebhook(
        {
          documentId: webhookPayload.id,
          status: webhookPayload.status,
          statusUpdatedAt: webhookPayload.status_updated_at,
        },
        db
      )

      if (!result.ok) {
        // Map error codes to HTTP status codes
        if (result.err === 'signature-not-found') {
          logger.warn(
            { documentId: webhookPayload.id },
            'Webhook received for unknown document'
          )
          ctx.status = 404
          ctx.body = { reason: 'Signature not found', ...metadata }
          return
        }

        // Other errors are internal server errors
        logger.error(
          { documentId: webhookPayload.id, error: result.err },
          'Failed to process webhook'
        )
        ctx.status = 500
        ctx.body = {
          error: 'Internal server error',
          reason: result.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        message: 'Webhook processed successfully',
        ...(result.data.fileId && { fileId: result.data.fileId }),
        ...metadata,
      }
    } catch (err: any) {
      logger.error(err, 'Error processing SimpleSign webhook')
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        reason: err.message,
        ...metadata,
      }
    }
  })
}
