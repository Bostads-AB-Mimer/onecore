/**
 * Business logic service for processing scanned receipt images
 *
 * This service handles the QR code extraction and receipt creation flow:
 * 1. Decode the scanned image using jimp
 * 2. Extract QR code data using jsQR
 * 3. Validate the extracted UUID
 * 4. Verify the key loan exists
 * 5. Create a receipt record
 *
 * File storage and loan activation are handled by core.
 */

import { Knex } from 'knex'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'
import * as receiptsAdapter from './adapters/receipts-adapter'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ScanReceiptError =
  | 'image-decode-failed'
  | 'no-qr-found'
  | 'invalid-uuid'
  | 'loan-not-found'
  | 'receipt-creation-failed'

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E; details?: string }

export async function extractQrFromImage(
  imageBuffer: Buffer
): Promise<Result<string, 'image-decode-failed' | 'no-qr-found'>> {
  let image
  try {
    image = await Jimp.read(imageBuffer)
  } catch {
    return { ok: false, err: 'image-decode-failed' }
  }

  const { width, height, data } = image.bitmap
  const qrResult = jsQR(new Uint8ClampedArray(data), width, height)

  if (!qrResult?.data) {
    return { ok: false, err: 'no-qr-found' }
  }

  return { ok: true, data: qrResult.data }
}

export function validateUuid(value: string): Result<string, 'invalid-uuid'> {
  if (!UUID_REGEX.test(value)) {
    return { ok: false, err: 'invalid-uuid', details: value }
  }
  return { ok: true, data: value }
}

export async function processScannedReceipt(
  imageBuffer: Buffer,
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ receiptId: string; keyLoanId: string }, ScanReceiptError>> {
  const qrResult = await extractQrFromImage(imageBuffer)
  if (!qrResult.ok) {
    return qrResult
  }

  const uuidResult = validateUuid(qrResult.data)
  if (!uuidResult.ok) {
    return uuidResult
  }

  const keyLoanId = uuidResult.data

  const loanExists = await receiptsAdapter.keyLoanExists(
    keyLoanId,
    dbConnection
  )
  if (!loanExists) {
    return { ok: false, err: 'loan-not-found', details: keyLoanId }
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

    return { ok: true, data: { receiptId: receipt.id, keyLoanId } }
  } catch {
    return { ok: false, err: 'receipt-creation-failed' }
  }
}
