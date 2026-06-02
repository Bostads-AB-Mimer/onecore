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
import { fetchLeasesByRentalPropertyId } from './api/leaseSearchService'
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

/**
 * One option per DISTINCT rental object on the loan's keys: the object's resolved
 * address and the lease(s) on it whose tenants include the loan's contact(s). The
 * receipt's object + Avtal are chosen from these (never the page lease). Empty when
 * the keys carry no rental object.
 */
export type LoanObjectOption = {
  rentalPropertyId: string
  address: string | null
  matches: Lease[]
}

export async function resolveLoanReceiptObjects(
  loan: Pick<KeyLoanWithDetails, 'contact' | 'contact2' | 'keysArray'>
): Promise<LoanObjectOption[]> {
  const codes = [loan.contact, loan.contact2]
    .map((code) => code?.trim().toUpperCase())
    .filter((code): code is string => !!code)

  const rentalPropertyIds = [
    ...new Set(
      (loan.keysArray ?? [])
        .map((key) => key.rentalObjectCode)
        .filter((code): code is string => !!code && code.length > 0)
    ),
  ]

  return Promise.all(
    rentalPropertyIds.map(async (rentalPropertyId) => {
      const leases = await fetchLeasesByRentalPropertyId(rentalPropertyId)
      const matches = leases.filter((lease) =>
        (lease.tenants ?? []).some(
          (tenant) =>
            tenant.contactCode &&
            codes.includes(tenant.contactCode.toUpperCase())
        )
      )
      return {
        rentalPropertyId,
        address: await resolveObjectAddress(rentalPropertyId),
        matches,
      }
    })
  )
}

/**
 * Picks the object + Avtal for a non-interactive (auto-generated) return receipt,
 * which can't prompt. Single object → use it (address always; Avtals-ID only on a
 * single lease match). Multiple objects → use the one object that uniquely has a
 * matching lease; otherwise leave object/address/Avtals-ID blank rather than guess.
 */
export function pickAutoReturnContract(options: LoanObjectOption[]): {
  rentalPropertyId?: string
  address: string | null
  leaseDisplayId?: string
} {
  const withMatch = options.filter((o) => o.matches.length > 0)
  const chosen =
    options.length === 1
      ? options[0]
      : withMatch.length === 1
        ? withMatch[0]
        : undefined

  if (!chosen) return { rentalPropertyId: undefined, address: null }

  return {
    rentalPropertyId: chosen.rentalPropertyId,
    address: chosen.address,
    leaseDisplayId:
      chosen.matches.length === 1 ? chosen.matches[0].leaseId : undefined,
  }
}

// ============================================================================
// Data Assembly Functions
// ============================================================================

/** Resolves a rental object's street address, normalising the unknown case to null. */
async function resolveObjectAddress(
  rentalPropertyId: string
): Promise<string | null> {
  try {
    const fetched =
      await rentalObjectSearchService.getAddressByRentalId(rentalPropertyId)
    return fetched && fetched !== 'Okänd adress' ? fetched : null
  } catch {
    return null
  }
}

/**
 * Builds the base ReceiptData (borrower + keys) from an already-fetched loan. The
 * Avtal block (rentalPropertyId/address/leaseDisplayId) is chosen from the object
 * options and merged in by the caller — the dialog at print, the return path via
 * pickAutoReturnContract — so it's intentionally absent here.
 */
async function assembleReceiptData(
  loan: KeyLoanWithDetails,
  receiptType: 'LOAN' | 'RETURN'
): Promise<ReceiptData> {
  const keys = loan.keysArray as KeyDetails[]
  const cards = loan.keyCardsArray || []
  const operationDate =
    receiptType === 'LOAN'
      ? loan.createdAt
        ? new Date(loan.createdAt)
        : new Date()
      : loan.returnedAt
        ? new Date(loan.returnedAt)
        : new Date()

  return {
    tenants: await resolveLoanTenants(loan),
    keys,
    receiptType,
    operationDate,
    loanId: loan.id,
    cards: cards.length > 0 ? cards : undefined,
  }
}

/**
 * Prepares a receipt from a loanId or receiptId in ONE loan fetch: the base
 * ReceiptData plus the per-object options (address + matching leases) the dialog
 * uses to pick the object and Avtals-ID, merged into the data at print time.
 */
export async function prepareReceipt({
  receiptId,
  loanId,
}: {
  receiptId?: string | null
  loanId?: string | null
}): Promise<{ receiptData: ReceiptData; objectOptions: LoanObjectOption[] }> {
  let receiptType: 'LOAN' | 'RETURN' = 'LOAN'
  let resolvedLoanId = loanId ?? null
  if (receiptId) {
    const receipt = await receiptService.getById(receiptId)
    receiptType = receipt.receiptType
    resolvedLoanId = receipt.keyLoanId
  }
  if (!resolvedLoanId) {
    throw new Error('Kan inte skapa kvittens: lånet saknas.')
  }

  const loan = (await keyLoanService.get(resolvedLoanId, {
    includeKeySystem: true,
    includeCards: true,
  })) as KeyLoanWithDetails

  const receiptData = await assembleReceiptData(loan, receiptType)
  const objectOptions = await resolveLoanReceiptObjects(loan)
  return { receiptData, objectOptions }
}

/**
 * Input for a tenant return receipt. `selected*Ids` are the items checked in the
 * dialog; when `partialReturn` is true the unchecked items continue on a new loan
 * and render as "NYCKLAR KVAR PÅ LÅN" instead of as missing.
 */
export type ReturnReceiptInput = {
  loan: Pick<KeyLoan, 'contact' | 'contact2'>
  loanKeys: KeyDetails[]
  selectedKeyIds: Set<string>
  // Avtal block — resolved by the caller (pickAutoReturnContract for auto returns).
  rentalPropertyId?: string
  address?: string | null
  leaseDisplayId?: string
  loanCards?: Card[]
  selectedCardIds?: Set<string>
  comment?: string
  partialReturn?: boolean
}

/**
 * Assembles ReceiptData for a return receipt. The borrower(s) are resolved from
 * the loan itself (not the lease), so the receipt names whoever the loan is
 * registered to; resolution can fall back to the contact API, so this is async.
 */
export async function assembleReturnReceipt({
  loan,
  loanKeys,
  selectedKeyIds,
  rentalPropertyId,
  address = null,
  leaseDisplayId,
  loanCards = [],
  selectedCardIds = new Set(),
  comment,
  partialReturn = false,
}: ReturnReceiptInput): Promise<ReceiptData> {
  const { returned, missing, disposed } = categorizeKeys(
    loanKeys,
    selectedKeyIds
  )
  const { returned: returnedCards, missing: missingCards } = categorizeCards(
    loanCards,
    selectedCardIds
  )

  return {
    rentalPropertyId,
    address,
    leaseDisplayId,
    tenants: await resolveLoanTenants(loan),
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
/**
 * Input for a maintenance return receipt. Same return/partial semantics as
 * ReturnReceiptInput, but the borrower is a company contact rather than a loan.
 */
export type MaintenanceReturnReceiptInput = {
  contact: string
  contactName: string
  contactPerson: string | null
  description?: string | null
  loanKeys: KeyDetails[]
  selectedKeyIds: Set<string>
  loanCards?: Card[]
  selectedCardIds?: Set<string>
  partialReturn?: boolean
}

async function assembleMaintenanceReturnReceipt({
  contact,
  contactName,
  contactPerson,
  description,
  loanKeys,
  selectedKeyIds,
  loanCards = [],
  selectedCardIds = new Set(),
  partialReturn = false,
}: MaintenanceReturnReceiptInput): Promise<MaintenanceReceiptData> {
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
 * Builds (assemble → PDF) a tenant return-receipt blob without uploading. The
 * blob-returning step is separate from upload so partial-return can merge it with
 * the prior signed receipt before uploading.
 */
export async function buildReturnReceiptBlob(
  input: ReturnReceiptInput
): Promise<{ blob: Blob; fileName: string }> {
  const receiptData = await assembleReturnReceipt(input)
  return generateReturnReceiptBlob(receiptData)
}

/** Builds (assemble → PDF) a maintenance return-receipt blob without uploading. */
export async function buildMaintenanceReturnReceiptBlob(
  input: MaintenanceReturnReceiptInput
): Promise<{ blob: Blob; fileName: string }> {
  const receiptData = await assembleMaintenanceReturnReceipt(input)
  return generateMaintenanceReturnReceiptBlob(receiptData)
}

/** Uploads a receipt PDF blob to MinIO against an existing receipt record. */
async function uploadReceiptFile(receiptId: string, blob: Blob): Promise<void> {
  const file = new File([blob], `return_${receiptId}.pdf`, {
    type: 'application/pdf',
  })
  await receiptService.uploadFile(receiptId, file)
}

/** Builds and uploads a tenant return receipt for a single loan. */
export async function generateAndUploadReturnReceipt({
  receiptId,
  ...input
}: ReturnReceiptInput & { receiptId: string }): Promise<void> {
  const { blob } = await buildReturnReceiptBlob(input)
  await uploadReceiptFile(receiptId, blob)
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

/** Builds and uploads a maintenance return receipt. */
export async function generateAndUploadMaintenanceReturnReceipt({
  receiptId,
  ...input
}: MaintenanceReturnReceiptInput & { receiptId: string }): Promise<void> {
  const { blob } = await buildMaintenanceReturnReceiptBlob(input)
  await uploadReceiptFile(receiptId, blob)
}
