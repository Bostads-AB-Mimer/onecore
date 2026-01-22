import { generateReturnReceiptBlob } from '@/lib/pdf-receipts'
import { openPdfInNewTab } from '@/lib/receiptPdfUtils'

import { cardService } from './api/cardService'
import { keyLoanService } from './api/keyLoanService'
import { keyService } from './api/keyService'
import { receiptService } from './api/receiptService'
import type { ReceiptData, Lease, Key, Card } from './types'

/**
 * Fetches all data needed for a receipt and constructs ReceiptData
 * @param receiptId - The receipt ID
 * @param lease - The lease associated with the receipt
 * @returns ReceiptData ready for PDF generation
 */
export async function fetchReceiptData(
  receiptId: string,
  lease: Lease
): Promise<ReceiptData> {
  // Get the receipt
  const receipt = await receiptService.getById(receiptId)
  console.log(
    'fetchReceiptData - receiptId:',
    receiptId,
    'receiptType:',
    receipt.receiptType
  )

  // Get the key loan from the receipt
  const keyLoan = await keyLoanService.get(receipt.keyLoanId)

  // Parse key IDs from the loan
  let keyIds: string[] = []
  try {
    keyIds = JSON.parse(keyLoan.keys || '[]')
  } catch {
    // Fallback to comma-separated if not JSON
    keyIds = keyLoan.keys ? keyLoan.keys.split(',').map((id) => id.trim()) : []
  }

  // Parse card IDs from the loan
  let cardIds: string[] = []
  try {
    cardIds = JSON.parse(keyLoan.keyCards || '[]')
  } catch {
    cardIds = keyLoan.keyCards
      ? keyLoan.keyCards.split(',').map((id) => id.trim())
      : []
  }

  // Fetch all keys
  const keys = await Promise.all(
    keyIds.map((keyId) => keyService.getKey(keyId))
  )

  // Fetch all cards
  let cards: Card[] = []
  if (cardIds.length > 0) {
    const cardResults = await Promise.all(
      cardIds.map((cardId) => cardService.getCard(cardId))
    )
    cards = cardResults.filter((card): card is Card => card !== null)
  }

  // Determine operation date based on receipt type
  const operationDate =
    receipt.receiptType === 'LOAN'
      ? keyLoan.createdAt
        ? new Date(keyLoan.createdAt)
        : new Date()
      : keyLoan.returnedAt
        ? new Date(keyLoan.returnedAt)
        : new Date()

  // Construct ReceiptData
  return {
    lease,
    tenants: lease.tenants ?? [],
    keys,
    receiptType: receipt.receiptType,
    operationDate,
    cards: cards.length > 0 ? cards : undefined,
  }
}

/**
 * Generates and opens a receipt PDF in a new tab
 * @param receiptId - The receipt ID
 * @param lease - The lease associated with the receipt
 */
export async function generateAndOpenReceipt(
  receiptId: string,
  lease: Lease
): Promise<void> {
  const receiptData = await fetchReceiptData(receiptId, lease)
  await openPdfInNewTab(receiptData, receiptId)
}

/**
 * Generates and uploads a return receipt PDF to MinIO for a single loan
 * @param receiptId - The receipt ID
 * @param loanKeys - All key objects in this specific loan
 * @param selectedKeyIds - Key IDs that were checked in the dialog
 * @param lease - The lease associated with the receipt
 * @param loanCards - All card objects in this specific loan (optional)
 * @param selectedCardIds - Card IDs that were checked in the dialog (optional)
 */
export async function generateAndUploadReturnReceipt(
  receiptId: string,
  loanKeys: Key[],
  selectedKeyIds: Set<string>,
  lease: Lease,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set()
): Promise<void> {
  // Categorize keys into returned/missing/disposed
  const returned: Key[] = []
  const missing: Key[] = []
  const disposed: Key[] = []

  loanKeys.forEach((key) => {
    if (key.disposed) {
      disposed.push(key)
    } else if (selectedKeyIds.has(key.id)) {
      returned.push(key)
    } else {
      missing.push(key)
    }
  })

  // Categorize cards into returned/missing
  const returnedCards: Card[] = []
  const missingCards: Card[] = []

  loanCards.forEach((card) => {
    if (selectedCardIds.has(card.cardId)) {
      returnedCards.push(card)
    } else {
      missingCards.push(card)
    }
  })

  // Build receipt data
  const receiptData: ReceiptData = {
    lease,
    tenants: lease.tenants ?? [],
    keys: returned,
    receiptType: 'RETURN',
    operationDate: new Date(),
    missingKeys: missing.length > 0 ? missing : undefined,
    disposedKeys: disposed.length > 0 ? disposed : undefined,
    cards: returnedCards.length > 0 ? returnedCards : undefined,
    missingCards: missingCards.length > 0 ? missingCards : undefined,
  }

  // Generate PDF blob
  const { blob } = await generateReturnReceiptBlob(receiptData, receiptId)

  // Convert to File and upload to MinIO
  const file = new File([blob], `return_${receiptId}.pdf`, {
    type: 'application/pdf',
  })

  await receiptService.uploadFile(receiptId, file)
}
