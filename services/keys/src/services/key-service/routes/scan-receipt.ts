import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import * as scanReceiptService from '../scan-receipt-service'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /scan-receipt:
   *   post:
   *     summary: Process a scanned receipt image
   *     description: |
   *       Receives a scanned receipt image, extracts the key loan UUID
   *       from the QR code, validates the loan exists, and creates a
   *       receipt record. Returns the receipt ID and loan ID so the
   *       caller (core) can handle file storage and loan activation.
   *     tags: [Receipts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/octet-stream:
   *           schema:
   *             type: string
   *             format: binary
   *     responses:
   *       201:
   *         description: Receipt created from scanned image
   *       400:
   *         description: Missing image data
   *       404:
   *         description: Key loan not found
   *       422:
   *         description: Could not extract valid QR code from image
   */
  router.post('/scan-receipt', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const rawBody = ctx.request.body
    let imageBuffer: Buffer

    if (Buffer.isBuffer(rawBody)) {
      imageBuffer = rawBody
    } else if (
      rawBody &&
      typeof rawBody === 'object' &&
      'imageData' in rawBody
    ) {
      imageBuffer = Buffer.from(rawBody.imageData as string, 'base64')
    } else {
      ctx.status = 400
      ctx.body = { error: 'Missing image data', ...metadata }
      return
    }

    const result = await scanReceiptService.processScannedReceipt(
      imageBuffer,
      db
    )

    if (!result.ok) {
      switch (result.err) {
        case 'image-decode-failed':
          ctx.status = 422
          ctx.body = { error: 'Could not decode image', ...metadata }
          return
        case 'no-qr-found':
          ctx.status = 422
          ctx.body = { error: 'No QR code found in image', ...metadata }
          return
        case 'invalid-uuid':
          logger.warn(
            { qrData: result.details },
            'QR code does not contain a valid UUID'
          )
          ctx.status = 422
          ctx.body = {
            error: 'QR code does not contain a valid UUID',
            ...metadata,
          }
          return
        case 'loan-not-found':
          ctx.status = 404
          ctx.body = {
            error: 'Key loan not found',
            keyLoanId: result.details,
            ...metadata,
          }
          return
        case 'receipt-creation-failed':
          logger.error('Error creating receipt from scanned image')
          ctx.status = 500
          ctx.body = { error: 'Internal server error', ...metadata }
          return
      }
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })
}
