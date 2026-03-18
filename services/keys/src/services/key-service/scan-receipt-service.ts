/**
 * Business logic service for processing scanned receipt images.
 *
 * Supports single-page images (JPEG, PNG, BMP) and multi-page PDFs.
 * All inputs go through the same batch pipeline:
 *
 * 1. Extract frames (pdfjs-dist for PDF, Jimp for other formats)
 * 2. Scan each frame for a QR code (jsQR)
 * 3. Group frames by decoded UUID
 * 4. For each group: validate UUID, verify loan, create receipt
 * 5. Extract each group's pages as a separate PDF for storage
 *
 * File storage and loan activation are handled by core.
 */

import { Knex } from 'knex'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'
import { PDFDocument } from 'pdf-lib'
import { logger } from '@onecore/utilities'
import * as receiptsAdapter from './adapters/receipts-adapter'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Frame {
  rgba: Uint8Array
  width: number
  height: number
}

export type ScanReceiptError =
  | 'image-decode-failed'
  | 'no-qr-found'
  | 'invalid-uuid'
  | 'loan-not-found'
  | 'receipt-creation-failed'

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E; details?: string }

interface BatchResult {
  receiptId: string
  keyLoanId: string
  imageData: string
}

interface BatchError {
  error: ScanReceiptError
  details?: string
  pageIndices: number[]
}

export interface BatchResponse {
  results: BatchResult[]
  errors: BatchError[]
}

/**
 * Check PDF magic bytes: %PDF (25 50 44 46)
 */
function isPdf(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  )
}

/**
 * Extract frames from a PDF buffer using pdfjs-dist.
 * Each page is rendered to a @napi-rs/canvas, then we read RGBA pixel data.
 */
async function extractPdfFrames(buffer: Buffer): Promise<Frame[]> {
  const { createCanvas } = await import('@napi-rs/canvas')
  const data = new Uint8Array(buffer)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise
  const frames: Frame[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    // pdfjs v5 requires `canvas` (typed as HTMLCanvasElement),
    // @napi-rs/canvas is API-compatible but differently typed

    await page.render({ canvas: canvas as any, viewport }).promise

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    frames.push({
      rgba: new Uint8Array(imageData.data),
      width: canvas.width,
      height: canvas.height,
    })

    page.cleanup()
  }

  await doc.cleanup()
  return frames
}

/**
 * Extract all frames from a buffer.
 * PDF → pdfjs-dist (handles multi-page), other formats → Jimp (single frame).
 */
async function extractFrames(buffer: Buffer): Promise<Frame[]> {
  if (isPdf(buffer)) {
    return extractPdfFrames(buffer)
  }

  const image = await Jimp.read(buffer)
  const { width, height, data } = image.bitmap
  return [{ rgba: new Uint8Array(data), width, height }]
}

/**
 * Scan a single frame for a QR code.
 * Returns the decoded string or null if no QR found.
 */
function scanFrameForQr(frame: Frame): string | null {
  const result = jsQR(
    new Uint8ClampedArray(frame.rgba),
    frame.width,
    frame.height
  )
  return result?.data || null
}

/**
 * Extract specific pages from a PDF into a new PDF document.
 * Page indices are 0-based.
 */
async function extractPdfPages(
  originalBuffer: Buffer,
  pageIndices: number[]
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(originalBuffer)
  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices)
  for (const page of copiedPages) {
    newDoc.addPage(page)
  }
  const pdfBytes = await newDoc.save()
  return Buffer.from(pdfBytes)
}

function validateUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

/**
 * Process a scanned receipt image (single or multi-page).
 *
 * Extracts frames, scans for QR codes, groups by UUID,
 * and creates a receipt for each unique loan.
 */
export async function processScannedReceipts(
  imageBuffer: Buffer,
  dbConnection: Knex | Knex.Transaction
): Promise<BatchResponse> {
  const results: BatchResult[] = []
  const errors: BatchError[] = []
  const inputIsPdf = isPdf(imageBuffer)

  // 1. Extract frames
  let frames: Frame[]
  try {
    frames = await extractFrames(imageBuffer)
  } catch (err) {
    logger.error({ err }, 'Failed to decode image')
    errors.push({
      error: 'image-decode-failed',
      pageIndices: [],
    })
    return { results, errors }
  }

  if (frames.length === 0) {
    errors.push({ error: 'image-decode-failed', pageIndices: [] })
    return { results, errors }
  }

  // 2. Scan each frame for QR and group by UUID
  const groups = new Map<string, { pageIndices: number[] }>()
  const noQrPages: number[] = []

  for (let i = 0; i < frames.length; i++) {
    const qrData = scanFrameForQr(frames[i])

    if (!qrData) {
      logger.warn({ pageIndex: i }, 'No QR code found on page')
      noQrPages.push(i)
      continue
    }

    if (!validateUuid(qrData)) {
      logger.warn(
        { pageIndex: i, qrData },
        'QR code does not contain a valid UUID'
      )
      errors.push({
        error: 'invalid-uuid',
        details: qrData,
        pageIndices: [i],
      })
      continue
    }

    const uuid = qrData.toLowerCase()
    const existing = groups.get(uuid)
    if (existing) {
      existing.pageIndices.push(i)
    } else {
      groups.set(uuid, { pageIndices: [i] })
    }
  }

  if (noQrPages.length > 0) {
    errors.push({
      error: 'no-qr-found',
      details: `Pages without QR: ${noQrPages.join(', ')}`,
      pageIndices: noQrPages,
    })
  }

  if (groups.size === 0) {
    return { results, errors }
  }

  // 3. Process each UUID group
  for (const [keyLoanId, group] of groups) {
    const loanExists = await receiptsAdapter.keyLoanExists(
      keyLoanId,
      dbConnection
    )
    if (!loanExists) {
      errors.push({
        error: 'loan-not-found',
        details: keyLoanId,
        pageIndices: group.pageIndices,
      })
      continue
    }

    try {
      const receipt = await receiptsAdapter.createReceipt(
        {
          keyLoanId,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        },
        dbConnection
      )

      let fileBuffer: Buffer
      if (inputIsPdf) {
        // Extract this group's pages from the original PDF
        fileBuffer = await extractPdfPages(imageBuffer, group.pageIndices)
      } else {
        // Single image — store the original buffer
        fileBuffer = imageBuffer
      }

      results.push({
        receiptId: receipt.id,
        keyLoanId,
        imageData: fileBuffer.toString('base64'),
      })
    } catch (err) {
      logger.error({ err, keyLoanId }, 'Failed to create receipt')
      errors.push({
        error: 'receipt-creation-failed',
        details: keyLoanId,
        pageIndices: group.pageIndices,
      })
    }
  }

  return { results, errors }
}
