import {
  generateMaintenanceReturnReceiptBlob,
  generateReturnReceiptBlob,
} from '@/lib/pdf-receipts'
import { mergePdfBlobs } from '@/lib/pdf-merge'

import { keyLoanService } from './api/keyLoanService'
import { receiptService } from './api/receiptService'
import { keyService } from './api/keyService'
import {
  assembleMaintenanceReturnReceipt,
  assembleReturnReceipt,
  generateAndUploadReturnReceipt,
  resolveLoanContract,
} from './receiptHandlers'
import type {
  Card,
  CreateKeyLoanRequest,
  KeyDetails,
  KeyLoan,
  KeyLoanWithDetails,
  Lease,
  UpdateKeyLoanRequest,
} from './types'

export type LoanKeysParams = {
  keyIds?: string[]
  cardIds?: string[]
  contact?: string
  contact2?: string
}

export type LoanKeysResult = {
  success: boolean
  title: string
  message?: string
  keyLoanId?: string
  receiptId?: string
}

/**
 * Handler for loaning out keys and/or cards
 * @param keyIds - Array of key IDs to loan (optional)
 * @param cardIds - Array of card IDs to loan (optional)
 * @param contact - Primary contact code
 * @param contact2 - Secondary contact code (optional)
 * @returns Result with success status and keyLoanId
 */
export async function handleLoanKeys({
  keyIds = [],
  cardIds = [],
  contact,
  contact2,
}: LoanKeysParams): Promise<LoanKeysResult> {
  if (keyIds.length === 0 && cardIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar eller droppar valda',
    }
  }

  try {
    // Create the key loan in pending state (pickedUpAt will be set when receipt is signed)
    const payload: CreateKeyLoanRequest = {
      loanType: 'TENANT', // Tenant loans from regular key-loans menu
      contact,
      contact2,
      ...(keyIds.length > 0 ? { keys: keyIds } : {}),
      ...(cardIds.length > 0 ? { keyCards: cardIds } : {}),
      // createdBy is set automatically by backend from authenticated user
    }

    const created = await keyLoanService.create(payload)

    // Create receipt for this loan
    let receiptId: string | undefined
    try {
      const receipt = await receiptService.create({
        keyLoanId: created.id,
        receiptType: 'LOAN',
        type: 'PHYSICAL', // <-- IMPORTANT: ensure backend accepts and returns an ID
      })
      receiptId = receipt.id
    } catch (receiptErr) {
      // Receipt creation failed, but loan succeeded
      console.error('Failed to create receipt:', receiptErr)
    }

    // Generate appropriate success message
    const itemTypes = []
    if (keyIds.length > 0) itemTypes.push('nycklar')
    if (cardIds.length > 0) itemTypes.push('droppar')
    const itemsLabel = itemTypes.join(' och ')

    return {
      success: true,
      title: 'Lån skapat - Kvittens måste signeras',
      message: `Lånet av ${itemsLabel} aktiveras när det signerade kvittensen laddas upp.`,
      keyLoanId: created.id,
      receiptId,
    }
  } catch (err: any) {
    const is409 = err?.status === 409 || err?.message?.includes('409')
    return {
      success: false,
      title: is409 ? 'Kan inte låna ut' : 'Fel',
      message: is409
        ? 'En eller flera nycklar/droppar är redan utlånade.'
        : err?.message || 'Kunde inte skapa lån.',
    }
  }
}

export type ReturnKeysParams = {
  keyIds?: string[] // ALL keys being returned (entire loan)
  cardIds?: string[] // ALL cards being returned (entire loan)
  availableToNextTenantFrom?: string // ISO date string
  selectedForReceipt?: string[] // Key IDs that were checked in dialog (for receipt PDF)
  selectedCardsForReceipt?: string[] // Card IDs that were checked in dialog (for receipt PDF)
  lease?: Lease // Lease information for PDF generation
  comment?: string // Optional comment for the receipt (max 280 chars)
}

export type ReturnKeysResult = {
  success: boolean
  title: string
  message?: string
  keyLoanId?: string
  receiptId?: string
}

/**
 * Handler for returning keys and/or cards
 * Validates that all keys/cards in each active loan are included in the return request
 * Creates a return receipt for the returned items
 * @param keyIds - Array of key IDs to return (optional)
 * @param cardIds - Array of card IDs to return (optional)
 * @returns Result with success status, keyLoanId, and receiptId
 */
export async function handleReturnKeys({
  keyIds = [],
  cardIds = [],
  availableToNextTenantFrom,
  selectedForReceipt,
  selectedCardsForReceipt,
  comment,
}: ReturnKeysParams): Promise<ReturnKeysResult> {
  if (keyIds.length === 0 && cardIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar eller droppar valda',
    }
  }

  try {
    const now = new Date().toISOString()
    const keyIdSet = new Set(keyIds)
    const cardIdSet = new Set(cardIds)
    let lastProcessedLoanId: string | undefined
    let receiptId: string | undefined

    // Build a map of unique active loans first to avoid duplicate fetches
    const uniqueActiveLoans = new Map<string, KeyLoan>()

    // Fetch loans for both keys and cards
    const keyLoansPromises = keyIds.map((keyId) =>
      keyLoanService.getByKeyId(keyId)
    )
    const cardLoansPromises = cardIds.map((cardId) =>
      keyLoanService.getByCardId(cardId)
    )
    const allLoansResults = await Promise.all([
      ...keyLoansPromises,
      ...cardLoansPromises,
    ])

    allLoansResults.forEach((loans) => {
      const activeLoan = loans.find((loan) => !loan.returnedAt)
      if (activeLoan && !uniqueActiveLoans.has(activeLoan.id)) {
        uniqueActiveLoans.set(activeLoan.id, activeLoan)
      }
    })

    for (const [loanId] of uniqueActiveLoans.entries()) {
      // Fetch loan with details to get key and card IDs
      const enrichedLoan = (await keyLoanService.get(loanId, {
        includeCards: true,
      })) as KeyLoanWithDetails
      const loanKeyIds = enrichedLoan.keysArray?.map((k) => k.id) || []
      const loanCardIds = enrichedLoan.keyCardsArray?.map((c) => c.cardId) || []

      const missingKeys = loanKeyIds.filter((id) => !keyIdSet.has(id))
      const missingCards = loanCardIds.filter((id) => !cardIdSet.has(id))
      const totalMissing = missingKeys.length + missingCards.length

      if (totalMissing > 0) {
        const itemTypes = []
        if (missingKeys.length > 0)
          itemTypes.push(`${missingKeys.length} nyckel/nycklar`)
        if (missingCards.length > 0)
          itemTypes.push(`${missingCards.length} droppe/droppar`)

        return {
          success: false,
          title: 'Kan inte återlämna',
          message: `Alla nycklar och droppar från samma utlåning måste återlämnas samtidigt. ${itemTypes.join(' och ')} saknas.`,
        }
      }

      // Create the receipt and its PDF BEFORE marking the loan returned, so a
      // failure to produce a correct kvittens (e.g. unresolved contact) aborts the
      // return via the outer catch rather than leaving a returned loan without one.
      const receipt = await receiptService.create({
        keyLoanId: loanId,
        receiptType: 'RETURN',
        type: 'PHYSICAL',
      })
      receiptId = receipt.id

      if (selectedForReceipt) {
        const keyLoan = (await keyLoanService.get(loanId, {
          includeKeySystem: true,
          includeCards: true,
        })) as KeyLoanWithDetails

        const loanKeys = keyLoan.keysArray as KeyDetails[]
        const loanCards = (keyLoan.keyCardsArray || []) as Card[]
        const selectedKeySet = new Set(selectedForReceipt)
        const selectedCardSet = new Set(selectedCardsForReceipt || [])
        // Avtals-ID resolved from the loan, not the page: use it only when exactly
        // one lease matches (non-interactive flow can't prompt).
        const { matches } = await resolveLoanContract(keyLoan)
        const leaseDisplayId =
          matches.length === 1 ? matches[0].leaseId : undefined
        await generateAndUploadReturnReceipt(
          receiptId,
          keyLoan,
          loanKeys,
          selectedKeySet,
          leaseDisplayId,
          loanCards,
          selectedCardSet,
          comment
        )
      }

      // Receipt is in place — now mark the loan returned.
      lastProcessedLoanId = loanId
      await keyLoanService.update(loanId, {
        returnedAt: now,
        availableToNextTenantFrom: availableToNextTenantFrom ?? null,
      } as UpdateKeyLoanRequest)
    }

    // Generate appropriate success message
    const itemTypes = []
    if (keyIds.length > 0) itemTypes.push('nycklar')
    if (cardIds.length > 0) itemTypes.push('droppar')
    const itemsLabel = itemTypes.join(' och ')

    return {
      success: true,
      title: `${itemsLabel.charAt(0).toUpperCase() + itemsLabel.slice(1)} återlämnade`,
      keyLoanId: lastProcessedLoanId,
      receiptId,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte återlämna nycklar/droppar.',
    }
  }
}

export type PartialReturnParams = {
  oldLoanId: string
  selectedKeyIds: Set<string>
  selectedCardIds: Set<string>
  availableToNextTenantFrom?: string
  // Tenant-only
  lease?: Lease
  comment?: string
  // Maintenance-only
  maintenanceContext?: {
    contact: string
    contactName: string
    contactPerson: string | null
    notes: string | null | undefined
  }
}

export type PartialReturnResult = {
  success: boolean
  title: string
  message?: string
  newLoanId?: string
  /** True when the old loan had no LOAN receipt to merge — new loan-receipt is the return PDF only. */
  fellBackToReturnOnly?: boolean
}

/**
 * Closes the old loan with a return receipt that lists only the selected keys/cards,
 * then creates a continuation loan containing the unselected items. The continuation
 * loan's LOAN receipt is the merger of the original signed loan receipt + the new
 * return receipt, so the full paper trail follows the still-held keys.
 *
 * Disposed keys are never carried to the continuation loan — caller is responsible
 * for excluding them from selectedKeyIds; they remain attached to the closed old loan.
 *
 * Per loan; the dialog fans out across affected loans.
 */
export async function handlePartialReturn(
  params: PartialReturnParams
): Promise<PartialReturnResult> {
  const {
    oldLoanId,
    selectedKeyIds,
    selectedCardIds,
    availableToNextTenantFrom,
    comment,
    maintenanceContext,
  } = params

  try {
    const now = new Date().toISOString()

    const oldLoan = (await keyLoanService.get(oldLoanId, {
      includeKeySystem: true,
      includeCards: true,
    })) as KeyLoanWithDetails

    const allKeys = (oldLoan.keysArray ?? []) as KeyDetails[]
    const allCards = (oldLoan.keyCardsArray ?? []) as Card[]

    // Disposed keys stay with the closed old loan; never carry to continuation.
    const unselectedKeyIds = allKeys
      .filter((k) => !k.disposed && !selectedKeyIds.has(k.id))
      .map((k) => k.id)
    const unselectedCardIds = allCards
      .filter((c) => !selectedCardIds.has(c.cardId))
      .map((c) => c.cardId)

    if (unselectedKeyIds.length === 0 && unselectedCardIds.length === 0) {
      return {
        success: false,
        title: 'Fel',
        message:
          'Inga nycklar eller droppar kvar att överföra till nytt lån. Använd vanlig återlämning istället.',
      }
    }

    // 1. Close the old loan
    await keyLoanService.update(oldLoanId, {
      returnedAt: now,
      availableToNextTenantFrom: availableToNextTenantFrom ?? null,
    } as UpdateKeyLoanRequest)

    // 2. Create return-receipt row for old loan
    const returnReceipt = await receiptService.create({
      keyLoanId: oldLoanId,
      receiptType: 'RETURN',
      type: 'PHYSICAL',
    })

    // 3. Build the return-receipt PDF for old loan, listing only selected items.
    //    We need the blob in-hand for step 6, so we don't use the
    //    generate-and-upload helper here.
    let returnBlob: Blob
    if (oldLoan.loanType === 'MAINTENANCE') {
      if (!maintenanceContext) {
        throw new Error(
          'maintenanceContext krävs för partiell retur av underhållslån'
        )
      }
      const returnData = await assembleMaintenanceReturnReceipt(
        maintenanceContext.contact,
        maintenanceContext.contactName,
        maintenanceContext.contactPerson,
        maintenanceContext.notes,
        allKeys,
        selectedKeyIds,
        allCards,
        selectedCardIds,
        true // partialReturn → unchecked items render as "kvar på lån"
      )
      const generated = await generateMaintenanceReturnReceiptBlob(returnData)
      returnBlob = generated.blob
    } else {
      // Avtals-ID resolved from the loan, not the page; use it only on a single match.
      const { matches } = await resolveLoanContract(oldLoan)
      const leaseDisplayId =
        matches.length === 1 ? matches[0].leaseId : undefined
      const returnData = await assembleReturnReceipt(
        oldLoan,
        allKeys,
        selectedKeyIds,
        leaseDisplayId,
        allCards,
        selectedCardIds,
        comment,
        true // partialReturn → unchecked items render as "kvar på lån"
      )
      const generated = await generateReturnReceiptBlob(returnData)
      returnBlob = generated.blob
    }

    // 4. Upload return PDF to old loan's return receipt
    const returnFile = new File(
      [returnBlob],
      `return_${returnReceipt.id}.pdf`,
      { type: 'application/pdf' }
    )
    await receiptService.uploadFile(returnReceipt.id, returnFile)

    // 5. Create continuation loan with the unselected items
    const newLoan = await keyLoanService.create({
      loanType: oldLoan.loanType,
      contact: oldLoan.contact ?? undefined,
      contact2: oldLoan.contact2 ?? undefined,
      contactPerson: oldLoan.contactPerson ?? undefined,
      notes: oldLoan.notes ?? undefined,
      pickedUpAt: now,
      ...(unselectedKeyIds.length > 0 ? { keys: unselectedKeyIds } : {}),
      ...(unselectedCardIds.length > 0 ? { keyCards: unselectedCardIds } : {}),
      // createdBy is set by backend from authenticated user
    } as CreateKeyLoanRequest)

    // 6. Build the merged loan-receipt for the new loan: original signed loan
    //    receipt followed by the return receipt we just generated. Falls back
    //    to the return PDF alone if no original is available.
    let combinedBlob: Blob = returnBlob
    let fellBackToReturnOnly = true

    try {
      const oldReceipts = await receiptService.getByKeyLoan(oldLoanId)
      const oldLoanReceipt = oldReceipts.find(
        (r) => r.receiptType === 'LOAN' && r.fileId
      )
      if (oldLoanReceipt) {
        const { url } = await receiptService.getDownloadUrl(oldLoanReceipt.id)
        const resp = await fetch(url)
        if (!resp.ok) {
          throw new Error(
            `Kunde inte hämta ursprunglig kvittens: ${resp.status}`
          )
        }
        const originalBlob = await resp.blob()
        combinedBlob = await mergePdfBlobs([originalBlob, returnBlob])
        fellBackToReturnOnly = false
      }
    } catch (mergeErr) {
      console.error(
        'Failed to fetch/merge original loan receipt; falling back to return PDF only:',
        mergeErr
      )
      combinedBlob = returnBlob
      fellBackToReturnOnly = true
    }

    // 7. Create new loan's LOAN receipt with the combined PDF
    const combinedFile = new File([combinedBlob], `loan_${newLoan.id}.pdf`, {
      type: 'application/pdf',
    })
    await receiptService.createWithFile(
      {
        keyLoanId: newLoan.id,
        receiptType: 'LOAN',
        type: 'PHYSICAL',
      },
      combinedFile
    )

    return {
      success: true,
      title: 'Partiell retur klar',
      newLoanId: newLoan.id,
      fellBackToReturnOnly: fellBackToReturnOnly || undefined,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte genomföra partiell retur.',
    }
  }
}

export type DisposeKeysParams = {
  keyIds: string[]
}

export type DisposeKeysResult = {
  success: boolean
  title: string
  message?: string
}

/**
 * Handler for disposing keys
 * @param keyIds - Array of key IDs to dispose
 * @returns Result with success status
 */
export async function handleDisposeKeys({
  keyIds,
}: DisposeKeysParams): Promise<DisposeKeysResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    // Update each key to set disposed = true
    await Promise.all(
      keyIds.map((keyId) => keyService.updateKey(keyId, { disposed: true }))
    )

    return {
      success: true,
      title: 'Nycklar kasserade',
      message: `${keyIds.length} ${keyIds.length === 1 ? 'nyckel har' : 'nycklar har'} kasserats.`,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte kassera nycklar.',
    }
  }
}

export type UndoDisposeKeysParams = {
  keyIds: string[]
}

export type UndoDisposeKeysResult = {
  success: boolean
  title: string
  message?: string
}

/**
 * Handler for undoing key disposal
 * @param keyIds - Array of key IDs to restore
 * @returns Result with success status
 */
export async function handleUndoDisposeKeys({
  keyIds,
}: UndoDisposeKeysParams): Promise<UndoDisposeKeysResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    // Update each key to set disposed = false
    await Promise.all(
      keyIds.map((keyId) => keyService.updateKey(keyId, { disposed: false }))
    )

    return {
      success: true,
      title: 'Ångrade kassering',
      message: `${keyIds.length} ${keyIds.length === 1 ? 'nyckel har' : 'nycklar har'} återställts.`,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte återställa nycklar.',
    }
  }
}
