import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  loggedAxios as axios,
} from '@onecore/utilities'
import * as fileStorageAdapter from '../../adapters/file-storage-adapter'
import { ReceiptsApi, KeyLoansApi } from '../../adapters/keys-adapter'
import config from '../../common/config'

const WEBDAV_MULTISTATUS_XML = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/scan-receipt/</D:href>
    <D:propstat>
      <D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`

async function sendErrorNotification(subject: string, message: string) {
  const email = config.scanner.errorNotificationEmail
  if (!email) return

  try {
    await axios.post(`${config.communicationService.url}/sendMessage`, {
      to: email,
      subject,
      text: message,
    })
  } catch (err) {
    logger.error(err, 'Failed to send scan error notification')
  }
}

export const routes = (router: KoaRouter) => {
  // WebDAV: OPTIONS handler
  router.options('/scan-receipt(.*)', (ctx) => {
    ctx.set('Allow', 'OPTIONS, HEAD, PROPFIND, PUT')
    ctx.set('DAV', '1')
    ctx.status = 200
  })

  // WebDAV: HEAD handler — scanner "test connection" and pre-upload check
  router.head('/scan-receipt(.*)', (ctx) => {
    ctx.status = 200
  })

  // WebDAV: PROPFIND stub — scanner/client checks if destination exists
  router.all('/scan-receipt(.*)', async (ctx, next) => {
    if (ctx.method !== 'PROPFIND') return next()

    const subpath = ctx.params[0] || ''

    if (subpath === '' || subpath === '/') {
      // Directory listing — report as collection
      ctx.status = 207
      ctx.type = 'application/xml'
      ctx.body = WEBDAV_MULTISTATUS_XML
    } else {
      // File paths — we don't store files, so always 404
      ctx.status = 404
    }
  })

  // WebDAV: PUT — the actual scan upload
  router.put('/scan-receipt/:filename', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const filename = ctx.params.filename

    // Read raw binary body from request stream (koa-body is skipped for this path)
    const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20 MB
    const chunks: Buffer[] = []
    let totalBytes = 0
    for await (const chunk of ctx.req) {
      totalBytes += chunk.length
      if (totalBytes > MAX_UPLOAD_BYTES) {
        ctx.req.destroy()
        ctx.status = 413
        ctx.body = { error: 'Upload exceeds 20 MB limit', ...metadata }
        return
      }
      chunks.push(chunk as Buffer)
    }
    const imageBuffer = Buffer.concat(chunks)

    if (imageBuffer.length === 0) {
      // WebDAV clients (e.g. Canon scanners) send an empty PUT first to
      // establish auth, then follow up with the actual file data.
      // Return 201 so the client proceeds to send the real upload.
      ctx.status = 201
      return
    }

    // Forward image to keys service for QR scanning + receipt creation
    let batch: {
      results: Array<{
        receiptId: string
        keyLoanId: string
        imageData: string
      }>
      errors: Array<{ error: string; details?: string; pageIndices: number[] }>
    }

    try {
      const response = await axios.post(
        `${config.keysService.url}/scan-receipt`,
        { imageData: imageBuffer.toString('base64') },
        { headers: { 'Content-Type': 'application/json' } }
      )
      batch = response.data.content
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number
          data?: { error?: string }
        }
      }
      const status = axiosErr.response?.status
      const errorMsg = axiosErr.response?.data?.error || 'Unknown error'

      logger.error({ err, filename }, 'Scan receipt processing failed')
      await sendErrorNotification(
        'Scan receipt failed',
        `Failed to process scanned receipt "${filename}": ${errorMsg}`
      )

      if (status === 422 || status === 404 || status === 400) {
        ctx.status = status
        ctx.body = { error: errorMsg, ...metadata }
        return
      }

      ctx.status = 502
      ctx.body = { error: 'Keys service error', ...metadata }
      return
    }

    // Send error notifications for any batch errors
    for (const error of batch.errors) {
      await sendErrorNotification(
        'Scan receipt failed',
        `Error processing "${filename}": ${error.error}${error.details ? ` (${error.details})` : ''} — pages: ${error.pageIndices.join(', ')}`
      )
    }

    if (batch.results.length === 0) {
      ctx.status = 422
      ctx.body = {
        error: 'No receipts could be created',
        errors: batch.errors,
        ...metadata,
      }
      return
    }

    // TODO: Extract shared upload→update receipt→activate loan helper.
    // receipts.ts (manual upload) has the same flow — deduplicate into a
    // common function so error handling stays consistent across both paths.
    const processed: Array<{
      receiptId: string
      keyLoanId: string
      fileId: string
    }> = []

    for (const result of batch.results) {
      const receiptBuffer = Buffer.from(result.imageData, 'base64')
      const isPdf =
        receiptBuffer.length >= 4 &&
        receiptBuffer[0] === 0x25 &&
        receiptBuffer[1] === 0x50 &&
        receiptBuffer[2] === 0x44 &&
        receiptBuffer[3] === 0x46
      const ext = isPdf ? 'pdf' : 'jpeg'
      const contentType = isPdf ? 'application/pdf' : 'image/jpeg'
      const storageFileName = `receipt-${result.receiptId}-${Date.now()}.${ext}`

      const uploadResult = await fileStorageAdapter.uploadFile(
        storageFileName,
        receiptBuffer,
        contentType
      )

      if (!uploadResult.ok) {
        logger.error(
          { err: uploadResult.err, receiptId: result.receiptId, metadata },
          'Failed to upload scanned receipt to file storage'
        )
        await sendErrorNotification(
          'Scan receipt upload failed',
          `Receipt ${result.receiptId} created but file upload failed for "${filename}"`
        )
        continue
      }

      const fileId = uploadResult.data.fileName

      const updateResult = await ReceiptsApi.update(result.receiptId, {
        fileId,
      })
      if (!updateResult.ok) {
        await fileStorageAdapter.deleteFile(fileId)
        logger.error(
          {
            err: updateResult.err,
            receiptId: result.receiptId,
            fileId,
            metadata,
          },
          'Failed to update receipt with fileId'
        )
        continue
      }

      const activateResult = await KeyLoansApi.activate(result.keyLoanId)
      if (!activateResult.ok) {
        logger.error(
          { err: activateResult.err, keyLoanId: result.keyLoanId, metadata },
          'Failed to activate key loan after scan receipt upload'
        )
      }

      processed.push({
        receiptId: result.receiptId,
        keyLoanId: result.keyLoanId,
        fileId,
      })
    }

    ctx.status = batch.errors.length > 0 ? 207 : 201
    ctx.body = {
      content: {
        processed,
        errors: batch.errors,
      },
      ...metadata,
    }
  })
}
