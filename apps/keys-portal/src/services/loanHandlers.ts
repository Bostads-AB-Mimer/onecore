import { keyLoanService } from './api/keyLoanService'
import { receiptService } from './api/receiptService'
import { keyService } from './api/keyService'
import { generateAndUploadReturnReceipt } from './receiptHandlers'
import type { Card, KeyDetails, KeyLoanWithDetails, Lease } from './types'

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
    const payload: any = {
      contact,
      contact2,
      loanType: 'TENANT', // Tenant loans from regular key-loans menu
      // createdBy is set automatically by backend from authenticated user
    }

    // Add keys and/or cards to the payload
    if (keyIds.length > 0) {
      payload.keys = JSON.stringify(keyIds)
    }
    if (cardIds.length > 0) {
      payload.keyCards = JSON.stringify(cardIds)
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
  lease,
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
    const uniqueActiveLoans = new Map<string, any>()

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

    for (const [loanId, activeLoan] of uniqueActiveLoans.entries()) {
      const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')
      const loanCardIds: string[] = JSON.parse(activeLoan.keyCards || '[]')

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

      // Update the loan
      lastProcessedLoanId = loanId
      await keyLoanService.update(loanId, {
        returnedAt: now,
        availableToNextTenantFrom: availableToNextTenantFrom || now,
      } as any)

      // Create return receipt for this loan
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanId,
          receiptType: 'RETURN',
          type: 'PHYSICAL',
        })
        receiptId = receipt.id

        // Generate and upload PDF if we have lease info
        if (lease && receiptId && selectedForReceipt) {
          try {
            // Fetch loan with keys (including keySystem) and cards in one call
            const keyLoan = (await keyLoanService.get(loanId, {
              includeKeySystem: true,
              includeCards: true,
            })) as KeyLoanWithDetails

            const loanKeys = keyLoan.keysArray as KeyDetails[]
            const loanCards = (keyLoan.keyCardsArray || []) as Card[]

            // Generate and upload the return receipt PDF
            const selectedKeySet = new Set(selectedForReceipt)
            const selectedCardSet = new Set(selectedCardsForReceipt || [])
            await generateAndUploadReturnReceipt(
              receiptId,
              loanKeys,
              selectedKeySet,
              lease,
              loanCards,
              selectedCardSet,
              comment
            )
          } catch (pdfErr) {
            console.error('Failed to generate/upload PDF:', pdfErr)
            // Don't fail the return if PDF generation fails
          }
        }
      } catch (receiptErr) {
        console.error('Failed to create return receipt:', receiptErr)
      }
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
