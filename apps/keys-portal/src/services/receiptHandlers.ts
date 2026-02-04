/**
Receipt Handlers
 *
 * Orchestration layer for receipt operations.
 * Handles data assembly, PDF generation, and file operations.
 */

import {
  generateLoanReceiptBlob,
  generateReturnReceiptBlob,
  generateMaintenanceLoanReceiptBlob,
  generateMaintenanceReturnReceiptBlob,
} from '@/lib/pdf-receipts'

import { receiptService } from './api/receiptService'
import { keyLoanService } from './api/keyLoanService'
import { keyService } from './api/keyService'
import { cardService } from './api/cardService'
import { fetchContactByContactCode } from './api/contactService'
import type {
  ReceiptData,
  MaintenanceReceiptData,
  Lease,
  Key,
  Card,
} from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses JSON array or comma-separated string to string array
 */
function parseIds(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    return JSON.parse(value)
  } catch {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }
}

/**
 * Categorizes keys into returned/missing/disposed based on selection
 */
function categorizeKeys(
  keys: Key[],
  selectedIds: Set<string>
): { returned: Key[]; missing: Key[]; disposed: Key[] } {
  const returned: Key[] = []
  const missing: Key[] = []
  const disposed: Key[] = []

  keys.forEach((key) => {
    if (key.disposed) {
      disposed.push(key)
    } else if (selectedIds.has(key.id)) {
      returned.push(key)
    } else {
      missing.push(key)
    }
  })

  return { returned, missing, disposed }
}

/**
 * Categorizes cards into returned/missing based on selection
 */
function categorizeCards(
  cards: Card[],
  selectedIds: Set<string>
): { returned: Card[]; missing: Card[] } {
  const returned: Card[] = []
  const missing: Card[] = []

  cards.forEach((card) => {
    if (selectedIds.has(card.cardId)) {
      returned.push(card)
    } else {
      missing.push(card)
    }
  })

  return { returned, missing }
}

/**
 * Builds a keySystemMap from a list of keys by fetching key system details
 * @param keys - Array of keys to extract keySystemIds from
 * @returns Map of keySystemId -> systemCode
 */
async function buildKeySystemMap(keys: Key[]): Promise<Record<string, string>> {
  // Collect unique keySystemIds
  const keySystemIds = [
    ...new Set(
      keys
        .map((k) => k.keySystemId)
        .filter((id): id is string => id != null && id !== '')
    ),
  ]

  if (keySystemIds.length === 0) {
    return {}
  }

  // Fetch key systems in parallel
  const keySystems = await Promise.all(
    keySystemIds.map(async (id) => {
      try {
        return await keyService.getKeySystem(id)
      } catch {
        return null
      }
    })
  )

  // Build the map
  const map: Record<string, string> = {}
  keySystems.forEach((ks) => {
    if (ks) {
      map[ks.id] = ks.systemCode
    }
  })

  return map
}

// ============================================================================
// Data Assembly Functions
// ============================================================================

/**
 * Assembles ReceiptData by fetching receipt, loan, keys, and cards
 * Used for: viewing/printing existing receipts
 */
async function assembleFromReceipt(
  receiptId: string,
  lease: Lease
): Promise<ReceiptData> {
  // Fetch receipt and loan
  const receipt = await receiptService.getById(receiptId)
  const keyLoan = await keyLoanService.get(receipt.keyLoanId)

  // Parse IDs
  const keyIds = parseIds(keyLoan.keys)
  const cardIds = parseIds(keyLoan.keyCards)

  // Fetch keys and cards in parallel
  const [keys, cardResults] = await Promise.all([
    Promise.all(keyIds.map((id) => keyService.getKey(id))),
    cardIds.length > 0
      ? Promise.all(cardIds.map((id) => cardService.getCard(id)))
      : Promise.resolve([]),
  ])

  const cards = cardResults.filter((c): c is Card => c !== null)

  // Build keySystemMap for displaying lock system codes
  const keySystemMap = await buildKeySystemMap(keys)

  // Determine operation date based on receipt type
  const operationDate =
    receipt.receiptType === 'LOAN'
      ? keyLoan.createdAt
        ? new Date(keyLoan.createdAt)
        : new Date()
      : keyLoan.returnedAt
        ? new Date(keyLoan.returnedAt)
        : new Date()

  return {
    lease,
    tenants: lease.tenants ?? [],
    keys,
    receiptType: receipt.receiptType,
    operationDate,
    cards: cards.length > 0 ? cards : undefined,
    keySystemMap,
  }
}

/**
 * Assembles ReceiptData for a return receipt from pre-fetched data
 * Used for: generating return receipt PDFs (no additional API calls)
 */
function assembleReturnReceipt(
  loanKeys: Key[],
  selectedKeyIds: Set<string>,
  lease: Lease,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set(),
  keySystemMap?: Record<string, string>,
  comment?: string
): ReceiptData {
  const { returned, missing, disposed } = categorizeKeys(
    loanKeys,
    selectedKeyIds
  )
  const { returned: returnedCards, missing: missingCards } = categorizeCards(
    loanCards,
    selectedCardIds
  )

  return {
    lease,
    tenants: lease.tenants ?? [],
    keys: returned,
    receiptType: 'RETURN',
    operationDate: new Date(),
    missingKeys: missing.length > 0 ? missing : undefined,
    disposedKeys: disposed.length > 0 ? disposed : undefined,
    cards: returnedCards.length > 0 ? returnedCards : undefined,
    missingCards: missingCards.length > 0 ? missingCards : undefined,
    keySystemMap,
    comment,
  }
}

/**
 * Assembles MaintenanceReceiptData from loan ID
 * Used for: maintenance loan receipt generation
 */
async function assembleMaintenanceLoanReceipt(
  loanId: string
): Promise<MaintenanceReceiptData> {
  const loan = await keyLoanService.get(loanId)
  const keyIds = parseIds(loan.keys)
  const cardIds = parseIds(loan.keyCards)

  // Fetch keys, cards, and contact info in parallel
  const [keys, cardResults, contactInfo] = await Promise.all([
    Promise.all(keyIds.map((id) => keyService.getKey(id))),
    cardIds.length > 0
      ? Promise.all(cardIds.map((id) => cardService.getCard(id)))
      : Promise.resolve([]),
    loan.contact
      ? fetchContactByContactCode(loan.contact)
      : Promise.resolve(null),
  ])

  const cards = cardResults.filter((c): c is Card => c !== null)
  const contactName = contactInfo?.fullName || loan.contact || 'Unknown'

  // Build keySystemMap for displaying lock system codes
  const keySystemMap = await buildKeySystemMap(keys)

  return {
    contact: loan.contact || 'Unknown',
    contactName,
    contactPerson: loan.contactPerson ?? null,
    description: loan.description,
    keys,
    receiptType: 'LOAN',
    operationDate: new Date(),
    cards: cards.length > 0 ? cards : undefined,
    keySystemMap,
  }
}

/**
 * Assembles MaintenanceReceiptData for a return receipt from pre-fetched data
 * Used for: generating maintenance return receipt PDFs (no additional API calls)
 */
function assembleMaintenanceReturnReceipt(
  contact: string,
  contactName: string,
  contactPerson: string | null,
  description: string | null | undefined,
  loanKeys: Key[],
  selectedKeyIds: Set<string>,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set(),
  keySystemMap?: Record<string, string>
): MaintenanceReceiptData {
  const { returned, missing, disposed } = categorizeKeys(
    loanKeys,
    selectedKeyIds
  )
  const { returned: returnedCards, missing: missingCards } = categorizeCards(
    loanCards,
    selectedCardIds
  )

  return {
    contact,
    contactName,
    contactPerson,
    description,
    keys: returned,
    receiptType: 'RETURN',
    operationDate: new Date(),
    missingKeys: missing.length > 0 ? missing : undefined,
    disposedKeys: disposed.length > 0 ? disposed : undefined,
    cards: returnedCards.length > 0 ? returnedCards : undefined,
    missingCards: missingCards.length > 0 ? missingCards : undefined,
    keySystemMap,
  }
}

// ============================================================================
// Shared PDF Viewer Helper
// ============================================================================

/**
 * Opens a PDF blob in a new browser tab with automatic print dialog.
 * Handles popup blocking, loading state, and URL cleanup.
 */
function openPdfBlobInNewTab(blob: Blob, fileName: string): void {
  const win = window.open('', '_blank')
  if (!win) {
    console.error('Popup blocked - could not open PDF')
    return
  }

  win.document.write(
    '<!doctype html><title>Kvittens</title><body>Förbereder kvittens…</body>'
  )
  win.document.close()

  const pdfUrl = URL.createObjectURL(blob)
  const viewerHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>html,body,iframe{margin:0;padding:0;height:100%;width:100%;border:0}</style>
</head>
<body>
  <iframe id="pdf" src="${pdfUrl}#view=FitH" allow="clipboard-write"></iframe>
  <script>
    const iframe = document.getElementById('pdf');
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          iframe.contentWindow && iframe.contentWindow.print && iframe.contentWindow.print();
        } catch (e) {
          console.error('Failed to trigger print:', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`

  const viewerBlob = new Blob([viewerHtml], { type: 'text/html' })
  const viewerUrl = URL.createObjectURL(viewerBlob)
  win.location.href = viewerUrl

  setTimeout(
    () => {
      URL.revokeObjectURL(pdfUrl)
      URL.revokeObjectURL(viewerUrl)
    },
    5 * 60 * 1000
  )
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetches all data needed for a receipt and constructs ReceiptData
 *
 * @param receiptId - The receipt ID
 * @param lease - The lease associated with the receipt
 * @returns ReceiptData ready for PDF generation
 */
export async function fetchReceiptData(
  receiptId: string,
  lease: Lease
): Promise<ReceiptData> {
  return assembleFromReceipt(receiptId, lease)
}

/**
 * Generates and uploads a return receipt PDF to MinIO for a single loan
 *
 * @param receiptId - The receipt ID
 * @param loanKeys - All key objects in this specific loan
 * @param selectedKeyIds - Key IDs that were checked in the dialog (returned keys)
 * @param lease - The lease associated with the receipt
 * @param loanCards - All card objects in this specific loan (optional)
 * @param selectedCardIds - Card IDs that were checked in the dialog (optional)
 * @param comment - Optional comment to include in the receipt (max 280 chars)
 */
export async function generateAndUploadReturnReceipt(
  receiptId: string,
  loanKeys: Key[],
  selectedKeyIds: Set<string>,
  lease: Lease,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set(),
  comment?: string
): Promise<void> {
  // Build keySystemMap for displaying lock system codes
  const keySystemMap = await buildKeySystemMap(loanKeys)

  // Assemble receipt data (no API calls - uses pre-fetched data)
  const receiptData = assembleReturnReceipt(
    loanKeys,
    selectedKeyIds,
    lease,
    loanCards,
    selectedCardIds,
    keySystemMap,
    comment
  )

  // Generate PDF blob
  const { blob } = await generateReturnReceiptBlob(receiptData, receiptId)

  // Convert to File and upload to MinIO
  const file = new File([blob], `return_${receiptId}.pdf`, {
    type: 'application/pdf',
  })

  await receiptService.uploadFile(receiptId, file)
}

/**
 * Opens a PDF receipt in a new browser tab with automatic print dialog
 *
 * @param receiptData - The receipt data to generate the PDF from
 * @param receiptId - Optional receipt ID to include in the PDF
 */
export async function openPdfInNewTab(
  receiptData: ReceiptData,
  receiptId?: string
): Promise<void> {
  const { blob, fileName } =
    receiptData.receiptType === 'RETURN'
      ? await generateReturnReceiptBlob(receiptData, receiptId)
      : await generateLoanReceiptBlob(receiptData, receiptId)

  openPdfBlobInNewTab(blob, fileName)
}

/**
 * Opens a maintenance loan receipt PDF in a new browser tab with automatic print dialog
 *
 * @param loanId - The loan ID to generate the receipt for
 */
export async function openMaintenanceReceiptInNewTab(
  loanId: string
): Promise<void> {
  const receiptData = await assembleMaintenanceLoanReceipt(loanId)
  const { blob, fileName } =
    await generateMaintenanceLoanReceiptBlob(receiptData)

  openPdfBlobInNewTab(blob, fileName)
}

/**
 * Generates and uploads a maintenance return receipt PDF to MinIO
 *
 * @param receiptId - The receipt ID
 * @param contact - Contact code (e.g., F088710)
 * @param contactName - Company name (from Contact.fullName)
 * @param contactPerson - Contact person name (optional)
 * @param description - Description (optional)
 * @param loanKeys - All key objects in this specific loan
 * @param selectedKeyIds - Key IDs that were checked in the dialog (returned keys)
 * @param loanCards - All card objects in this specific loan (optional)
 * @param selectedCardIds - Card IDs that were checked in the dialog (optional)
 */
export async function generateAndUploadMaintenanceReturnReceipt(
  receiptId: string,
  contact: string,
  contactName: string,
  contactPerson: string | null,
  description: string | null | undefined,
  loanKeys: Key[],
  selectedKeyIds: Set<string>,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set()
): Promise<void> {
  // Build keySystemMap for displaying lock system codes
  const keySystemMap = await buildKeySystemMap(loanKeys)

  // Assemble receipt data (no API calls - uses pre-fetched data)
  const receiptData = assembleMaintenanceReturnReceipt(
    contact,
    contactName,
    contactPerson,
    description,
    loanKeys,
    selectedKeyIds,
    loanCards,
    selectedCardIds,
    keySystemMap
  )

  // Generate PDF blob
  const { blob } = await generateMaintenanceReturnReceiptBlob(
    receiptData,
    receiptId
  )

  // Convert to File and upload to MinIO
  const file = new File([blob], `return_${receiptId}.pdf`, {
    type: 'application/pdf',
  })

  await receiptService.uploadFile(receiptId, file)
}
