import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  loggedAxios as axios,
} from '@onecore/utilities'
import { requireServiceAccountAuth } from '../../middlewares/service-account-auth'
import { requireAllowedIp } from '../../middlewares/ip-allowlist'
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
  const scanReceiptAuth = [
    requireAllowedIp,
    requireServiceAccountAuth('scanner-upload'),
  ]

  // WebDAV: OPTIONS handler
  router.options('/scan-receipt(.*)', ...scanReceiptAuth, (ctx) => {
    ctx.set('Allow', 'OPTIONS, PROPFIND, PUT')
    ctx.set('DAV', '1')
    ctx.status = 200
  })

  // WebDAV: PROPFIND stub — scanner/client checks if destination exists
  router.all('/scan-receipt(.*)', ...scanReceiptAuth, async (ctx, next) => {
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
  router.put('/scan-receipt/:filename', ...scanReceiptAuth, async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const filename = ctx.params.filename

    // Read raw binary body from request stream (koa-body is skipped for this path)
    const chunks: Buffer[] = []
    for await (const chunk of ctx.req) {
      chunks.push(chunk as Buffer)
    }
    const imageBuffer = Buffer.concat(chunks)

    if (imageBuffer.length === 0) {
      ctx.status = 400
      ctx.body = { error: 'Expected raw image data', ...metadata }
      return
    }

    // Forward image to keys service for QR scanning + receipt creation
    let scanResult
    try {
      const response = await axios.post(
        `${config.keysService.url}/scan-receipt`,
        { imageData: imageBuffer.toString('base64') },
        { headers: { 'Content-Type': 'application/json' } }
      )
      scanResult = response.data.content
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number
          data?: { error?: string; keyLoanId?: string }
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

    const { receiptId, keyLoanId } = scanResult

    // Upload scanned image to file storage (MinIO)
    const knownImageExts = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif', 'webp']
    const fileExt = filename.includes('.')
      ? filename.split('.').pop()!.toLowerCase()
      : ''
    const ext = knownImageExts.includes(fileExt) ? fileExt : 'jpeg'
    const contentType = ctx.request.type || 'image/jpeg'
    const storageFileName = `receipt-${receiptId}-${Date.now()}.${ext}`

    const uploadResult = await fileStorageAdapter.uploadFile(
      storageFileName,
      imageBuffer,
      contentType
    )

    if (!uploadResult.ok) {
      logger.error(
        { err: uploadResult.err, receiptId, metadata },
        'Failed to upload scanned receipt to file storage'
      )
      await sendErrorNotification(
        'Scan receipt upload failed',
        `Receipt ${receiptId} created but file upload failed for "${filename}"`
      )
      ctx.status = 500
      ctx.body = { error: 'File upload failed', ...metadata }
      return
    }

    const fileId = uploadResult.data.fileName

    // Update receipt with fileId
    const updateResult = await ReceiptsApi.update(receiptId, { fileId })
    if (!updateResult.ok) {
      await fileStorageAdapter.deleteFile(fileId)
      logger.error(
        { err: updateResult.err, receiptId, fileId, metadata },
        'Failed to update receipt with fileId'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Activate the key loan
    const activateResult = await KeyLoansApi.activate(keyLoanId)
    if (!activateResult.ok) {
      logger.error(
        { err: activateResult.err, keyLoanId, metadata },
        'Failed to activate key loan after scan receipt upload'
      )
    }

    ctx.status = 201
    ctx.body = {
      content: { receiptId, keyLoanId, fileId },
      ...metadata,
    }
  })
}
