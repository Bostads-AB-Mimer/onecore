import { keyLoanService } from './api/keyLoanService'
import { receiptService } from './api/receiptService'
import { keyService } from './api/keyService'
import { generateAndUploadReturnReceipt } from './receiptHandlers'
import type { Key, Lease } from './types'

export type LoanKeysParams = {
  keyIds: string[]
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
 * Handler for loaning out keys
 * @param keyIds - Array of key IDs to loan (can be single key)
 * @param contact - Primary contact code
 * @param contact2 - Secondary contact code (optional)
 * @returns Result with success status and keyLoanId
 */
export async function handleLoanKeys({
  keyIds,
  contact,
  contact2,
}: LoanKeysParams): Promise<LoanKeysResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    // Create the key loan in pending state (pickedUpAt will be set when receipt is signed)
    const created = await keyLoanService.create({
      keys: JSON.stringify(keyIds),
      contact,
      contact2,
      createdBy: 'ui',
    })

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

    return {
      success: true,
      title: 'Nyckellån skapat - Kvittens måste signeras',
      message: 'Nyckellånet aktiveras när det signerade kvittensen laddas upp.',
      keyLoanId: created.id,
      receiptId,
    }
  } catch (err: any) {
    const is409 = err?.status === 409 || err?.message?.includes('409')
    return {
      success: false,
      title: is409 ? 'Kan inte låna ut' : 'Fel',
      message: is409
        ? 'En eller flera nycklar är redan utlånade.'
        : err?.message || 'Kunde inte skapa nyckellån.',
    }
  }
}

export type ReturnKeysParams = {
  keyIds: string[] // ALL keys being returned (entire loan)
  availableToNextTenantFrom?: string // ISO date string
  selectedForReceipt?: string[] // Key IDs that were checked in dialog (for receipt PDF)
  lease?: Lease // Lease information for PDF generation
}

export type ReturnKeysResult = {
  success: boolean
  title: string
  message?: string
  keyLoanId?: string
  receiptId?: string
}

/**
 * Handler for returning keys
 * Validates that all keys in each active loan are included in the return request
 * Creates a return receipt for the returned keys
 * @param keyIds - Array of key IDs to return
 * @returns Result with success status, keyLoanId, and receiptId
 */
export async function handleReturnKeys({
  keyIds,
  availableToNextTenantFrom,
  selectedForReceipt,
  lease,
}: ReturnKeysParams): Promise<ReturnKeysResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    const now = new Date().toISOString()
    const keyIdSet = new Set(keyIds)
    let lastProcessedLoanId: string | undefined
    let receiptId: string | undefined

    // Build a map of unique active loans first to avoid duplicate fetches
    const uniqueActiveLoans = new Map<string, any>()

    const loansPromises = keyIds.map((keyId) =>
      keyLoanService.getByKeyId(keyId)
    )
    const allLoansResults = await Promise.all(loansPromises)

    allLoansResults.forEach((loans) => {
      const activeLoan = loans.find((loan) => !loan.returnedAt)
      if (activeLoan && !uniqueActiveLoans.has(activeLoan.id)) {
        uniqueActiveLoans.set(activeLoan.id, activeLoan)
      }
    })

    for (const [loanId, activeLoan] of uniqueActiveLoans.entries()) {
      const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')
      const missingKeys = loanKeyIds.filter((id) => !keyIdSet.has(id))

      if (missingKeys.length > 0) {
        return {
          success: false,
          title: 'Kan inte återlämna',
          message: `Alla nycklar från samma utlåning måste återlämnas samtidigt. ${missingKeys.length} nyckel/nycklar saknas.`,
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
            const keyPromises = loanKeyIds.map((keyId) =>
              keyService.getKey(keyId)
            )
            const keyResults = await Promise.all(keyPromises)
            const loanKeys: Key[] = keyResults.filter(
              (key): key is Key => key !== null
            )

            // Generate and upload the return receipt PDF
            const selectedSet = new Set(selectedForReceipt)
            await generateAndUploadReturnReceipt(
              receiptId,
              loanKeys,
              selectedSet,
              lease
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

    return {
      success: true,
      title: 'Nycklar återlämnade',
      keyLoanId: lastProcessedLoanId,
      receiptId,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte återlämna nycklar.',
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
