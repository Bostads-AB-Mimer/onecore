import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import * as scanReceiptService from '../scan-receipt-service'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /scan-receipt:
   *   post:
   *     summary: Process a scanned receipt image (single or batch)
   *     description: |
   *       Receives a scanned receipt image (JPEG, PNG, BMP, or multi-page PDF).
   *       Extracts QR codes from each page, groups pages by loan UUID,
   *       and creates a receipt for each unique loan.
   *       Returns an array of results and any errors.
   *     tags: [Receipts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               imageData:
   *                 type: string
   *                 format: byte
   *     responses:
   *       201:
   *         description: All receipts created successfully
   *       207:
   *         description: Partial success — some receipts created, some failed
   *       400:
   *         description: Missing image data
   *       422:
   *         description: No receipts could be created (decode/QR errors)
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

    const batch = await scanReceiptService.processScannedReceipts(
      imageBuffer,
      db
    )

    if (batch.results.length === 0) {
      ctx.status = 422
      ctx.body = { content: batch, ...metadata }
      return
    }

    if (batch.errors.length > 0) {
      logger.warn(
        { errors: batch.errors },
        'Partial scan receipt batch failure'
      )
    }

    ctx.status = batch.errors.length > 0 ? 207 : 201
    ctx.body = { content: batch, ...metadata }
  })
}
