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
import { fetchContactByContactCode } from './api/contactService'
import { rentalObjectSearchService } from './api/rentalObjectSearchService'
import type {
  ReceiptData,
  MaintenanceReceiptData,
  Lease,
  Tenant,
  KeyLoan,
  KeyDetails,
  Card,
  KeyLoanWithDetails,
} from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Categorizes keys into returned/missing/disposed based on selection
 */
export function categorizeKeys(
  keys: KeyDetails[],
  selectedIds: Set<string>
): { returned: KeyDetails[]; missing: KeyDetails[]; disposed: KeyDetails[] } {
  const returned: KeyDetails[] = []
  const missing: KeyDetails[] = []
  const disposed: KeyDetails[] = []

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
export function categorizeCards(
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
 * Resolves a loan's borrower(s) from its own contact codes (never the page's lease)
 * so the receipt names who the loan is registered to. Reuses a knownTenants match to
 * skip the API; throws if a code is missing/unresolvable, blocking the receipt.
 */
export async function resolveLoanTenants(
  loan: Pick<KeyLoan, 'contact' | 'contact2'>,
  knownTenants: Tenant[] = []
): Promise<Tenant[]> {
  const codes = [loan.contact, loan.contact2]
    .map((code) => code?.trim())
    .filter((code): code is string => !!code)
  const uniqueCodes = [...new Set(codes.map((code) => code.toUpperCase()))]

  if (uniqueCodes.length === 0) {
    throw new Error('Lånet saknar kontakt och kan inte få en kvittens.')
  }

  const knownByCode = new Map(
    knownTenants
      .filter((tenant) => tenant.contactCode)
      .map((tenant) => [tenant.contactCode.toUpperCase(), tenant])
  )

  const tenants: Tenant[] = []
  for (const code of uniqueCodes) {
    const known = knownByCode.get(code)
    if (known) {
      tenants.push(known)
      continue
    }
    const contact = await fetchContactByContactCode(code)
    if (!contact) {
      throw new Error(`Kunde inte hämta kontakten (${code}) för kvittensen.`)
    }
    tenants.push(contact)
  }

  return tenants
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
  // Fetch receipt
  const receipt = await receiptService.getById(receiptId)

  // Fetch loan with keys (including keySystem) and cards in one call
  const keyLoan = (await keyLoanService.get(receipt.keyLoanId, {
    includeKeySystem: true,
    includeCards: true,
  })) as KeyLoanWithDetails

  const keys = keyLoan.keysArray as KeyDetails[]
  const cards = keyLoan.keyCardsArray || []

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
    tenants: await resolveLoanTenants(keyLoan, lease.tenants ?? []),
    keys,
    receiptType: receipt.receiptType,
    operationDate,
    loanId: receipt.keyLoanId,
    cards: cards.length > 0 ? cards : undefined,
  }
}

/**
 * Assembles ReceiptData for a return receipt. The borrower(s) are resolved from
 * the loan itself (not the lease), so the receipt names whoever the loan is
 * registered to; resolution can fall back to the contact API, so this is async.
 */
export async function assembleReturnReceipt(
  loan: Pick<KeyLoan, 'contact' | 'contact2'>,
  loanKeys: KeyDetails[],
  selectedKeyIds: Set<string>,
  lease: Lease,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set(),
  comment?: string,
  // When true, unchecked items aren't missing — they continue on a new
  // continuation loan and get rendered in the "NYCKLAR KVAR PÅ LÅN" section.
  partialReturn = false
): Promise<ReceiptData> {
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
    tenants: await resolveLoanTenants(loan, lease.tenants ?? []),
    keys: returned,
    receiptType: 'RETURN',
    operationDate: new Date(),
    missingKeys: !partialReturn && missing.length > 0 ? missing : undefined,
    missingCards:
      !partialReturn && missingCards.length > 0 ? missingCards : undefined,
    remainingLoanKeys:
      partialReturn && missing.length > 0 ? missing : undefined,
    remainingLoanCards:
      partialReturn && missingCards.length > 0 ? missingCards : undefined,
    disposedKeys: disposed.length > 0 ? disposed : undefined,
    cards: returnedCards.length > 0 ? returnedCards : undefined,
    comment,
  }
}

/**
 * Builds a per-key scope map for a maintenance receipt's Tillhörighet column.
 * Each key resolves to its rentalObjectCode's street address, or falls back to
 * keySystem.name for HN master keys where rentalObjectCode is null. Missing
 * data renders as '-' so the receipt keeps a single consistent empty state.
 */
async function resolveScopeByKeyId(
  keys: KeyDetails[]
): Promise<Record<string, string>> {
  const uniqueCodes = Array.from(
    new Set(
      keys
        .map((k) => k.rentalObjectCode)
        .filter((c): c is string => !!c && c.length > 0)
    )
  )

  const addressMap =
    uniqueCodes.length > 0
      ? await rentalObjectSearchService.getAddressesByRentalIds(uniqueCodes)
      : {}

  const result: Record<string, string> = {}
  for (const key of keys) {
    if (key.rentalObjectCode) {
      result[key.id] = addressMap[key.rentalObjectCode] || '-'
    } else {
      result[key.id] = key.keySystem?.name || '-'
    }
  }
  return result
}

/**
 * Assembles MaintenanceReceiptData from loan ID
 * Used for: maintenance loan receipt generation
 */
export async function assembleMaintenanceLoanReceipt(
  loanId: string,
  comment?: string
): Promise<MaintenanceReceiptData> {
  // Fetch loan with keys (including keySystem) and cards in one call
  const loan = (await keyLoanService.get(loanId, {
    includeKeySystem: true,
    includeCards: true,
  })) as KeyLoanWithDetails

  const keys = loan.keysArray as KeyDetails[]
  const cards = loan.keyCardsArray || []

  // Fetch contact info
  const contactInfo = loan.contact
    ? await fetchContactByContactCode(loan.contact)
    : null
  const contactName = contactInfo?.fullName || loan.contact || 'Unknown'

  // Merge loan description with optional comment for the PDF comment box
  const description =
    [loan.notes, comment].filter(Boolean).join('\n\n') || undefined

  const scopeByKeyId = await resolveScopeByKeyId(keys)

  return {
    contact: loan.contact || 'Unknown',
    contactName,
    contactPerson: loan.contactPerson ?? null,
    description,
    keys,
    scopeByKeyId,
    receiptType: 'LOAN',
    operationDate: new Date(),
    loanId,
    cards: cards.length > 0 ? cards : undefined,
  }
}

/**
 * Assembles MaintenanceReceiptData for a return receipt.
 * Resolves rentalObjectCode → address via the rental-object search API,
 * so it needs to be awaited (one network call at most per receipt).
 */
export async function assembleMaintenanceReturnReceipt(
  contact: string,
  contactName: string,
  contactPerson: string | null,
  description: string | null | undefined,
  loanKeys: KeyDetails[],
  selectedKeyIds: Set<string>,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set(),
  partialReturn = false
): Promise<MaintenanceReceiptData> {
  const { returned, missing, disposed } = categorizeKeys(
    loanKeys,
    selectedKeyIds
  )
  const { returned: returnedCards, missing: missingCards } = categorizeCards(
    loanCards,
    selectedCardIds
  )

  // Resolve scope for the full loan set (not just the returned subset) so every
  // row in the receipt tables carries its Tillhörighet value.
  const scopeByKeyId = await resolveScopeByKeyId(loanKeys)

  return {
    contact,
    contactName,
    contactPerson,
    description,
    keys: returned,
    scopeByKeyId,
    receiptType: 'RETURN',
    operationDate: new Date(),
    missingKeys: !partialReturn && missing.length > 0 ? missing : undefined,
    missingCards:
      !partialReturn && missingCards.length > 0 ? missingCards : undefined,
    remainingLoanKeys:
      partialReturn && missing.length > 0 ? missing : undefined,
    remainingLoanCards:
      partialReturn && missingCards.length > 0 ? missingCards : undefined,
    disposedKeys: disposed.length > 0 ? disposed : undefined,
    cards: returnedCards.length > 0 ? returnedCards : undefined,
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
 * Assembles ReceiptData directly from a loan ID (no receipt record needed).
 * Used when the receipt record has been deleted but the loan still exists.
 */
export async function assembleFromLoan(
  loanId: string,
  lease: Lease
): Promise<ReceiptData> {
  const keyLoan = (await keyLoanService.get(loanId, {
    includeKeySystem: true,
    includeCards: true,
  })) as KeyLoanWithDetails

  const keys = keyLoan.keysArray as KeyDetails[]
  const cards = keyLoan.keyCardsArray || []

  return {
    lease,
    tenants: await resolveLoanTenants(keyLoan, lease.tenants ?? []),
    keys,
    receiptType: 'LOAN',
    operationDate: keyLoan.createdAt ? new Date(keyLoan.createdAt) : new Date(),
    loanId,
    cards: cards.length > 0 ? cards : undefined,
  }
}

/**
 * Generates and uploads a return receipt PDF to MinIO for a single loan
 *
 * @param receiptId - The receipt ID
 * @param loan - The loan being returned (its contacts identify the borrower(s))
 * @param loanKeys - All key objects in this specific loan (with keySystem included)
 * @param selectedKeyIds - Key IDs that were checked in the dialog (returned keys)
 * @param lease - The lease associated with the receipt
 * @param loanCards - All card objects in this specific loan (optional)
 * @param selectedCardIds - Card IDs that were checked in the dialog (optional)
 * @param comment - Optional comment to include in the receipt (max 280 chars)
 */
export async function generateAndUploadReturnReceipt(
  receiptId: string,
  loan: Pick<KeyLoan, 'contact' | 'contact2'>,
  loanKeys: KeyDetails[],
  selectedKeyIds: Set<string>,
  lease: Lease,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set(),
  comment?: string
): Promise<void> {
  // Assemble receipt data (borrower resolved from the loan, not the lease)
  const receiptData = await assembleReturnReceipt(
    loan,
    loanKeys,
    selectedKeyIds,
    lease,
    loanCards,
    selectedCardIds,
    comment
  )

  // Generate PDF blob
  const { blob } = await generateReturnReceiptBlob(receiptData)

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
 */
export async function openPdfInNewTab(receiptData: ReceiptData): Promise<void> {
  const { blob, fileName } =
    receiptData.receiptType === 'RETURN'
      ? await generateReturnReceiptBlob(receiptData)
      : await generateLoanReceiptBlob(receiptData)

  openPdfBlobInNewTab(blob, fileName)
}

/**
 * Opens a maintenance loan receipt PDF in a new browser tab with automatic print dialog
 *
 * @param loanId - The loan ID to generate the receipt for
 * @param comment - Optional comment to include in the receipt PDF
 */
export async function openMaintenanceReceiptInNewTab(
  loanId: string,
  comment?: string
): Promise<void> {
  const receiptData = await assembleMaintenanceLoanReceipt(loanId, comment)

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
 * @param loanKeys - All key objects in this specific loan (with keySystem included)
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
  loanKeys: KeyDetails[],
  selectedKeyIds: Set<string>,
  loanCards: Card[] = [],
  selectedCardIds: Set<string> = new Set()
): Promise<void> {
  const receiptData = await assembleMaintenanceReturnReceipt(
    contact,
    contactName,
    contactPerson,
    description,
    loanKeys,
    selectedKeyIds,
    loanCards,
    selectedCardIds
  )

  // Generate PDF blob
  const { blob } = await generateMaintenanceReturnReceiptBlob(receiptData)

  // Convert to File and upload to MinIO
  const file = new File([blob], `return_${receiptId}.pdf`, {
    type: 'application/pdf',
  })

  await receiptService.uploadFile(receiptId, file)
}
