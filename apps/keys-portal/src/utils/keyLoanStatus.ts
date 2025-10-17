import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'

export type KeyLoanInfo = {
  isLoaned: boolean
  contact: string | null // The contact code from the loan
  matchesCurrentTenant: boolean // Whether this loan matches the current tenant
  pickedUpAt?: string // When the key was picked up (for loaned keys)
  availableToNextTenantFrom?: string // When the key becomes available (from current loan if returned, or from previous loan if current is not picked up)
  hasSignedLoanReceipt?: boolean // Whether the loan has a signed receipt uploaded
}

/**
 * Fetches all loans for a specific key and determines if it's currently loaned.
 *
 * @param keyId - The ID of the key to check
 * @param currentContactCode - The primary contact code to compare against
 * @param currentContactCode2 - The secondary contact code to compare against (optional)
 * @returns Object with isLoaned status, contact code, and whether it matches current tenant
 */
export async function getKeyLoanStatus(
  keyId: string,
  currentContactCode?: string,
  currentContactCode2?: string
): Promise<KeyLoanInfo> {
  // Fetch all loans for this specific key
  const keyLoans = await keyLoanService.getByKeyId(keyId)

  // No loans at all
  if (keyLoans.length === 0) {
    return { isLoaned: false, contact: null, matchesCurrentTenant: false }
  }

  // Find active loan (one without a return date)
  const activeLoan = keyLoans.find((loan) => !loan.returnedAt)

  // Use the most recent loan (first in array since ordered by createdAt DESC)
  const loanToCheck = activeLoan || keyLoans[0]
  const isLoaned = !!activeLoan

  // Check for contact match (prioritize contact over contact2)
  const matchesCurrentTenant =
    (currentContactCode &&
      (loanToCheck.contact?.trim() === currentContactCode.trim() ||
        loanToCheck.contact2?.trim() === currentContactCode.trim())) ||
    (currentContactCode2 &&
      (loanToCheck.contact?.trim() === currentContactCode2.trim() ||
        loanToCheck.contact2?.trim() === currentContactCode2.trim())) ||
    false

  // Check if the active loan has a signed receipt
  let hasSignedLoanReceipt = false
  if (activeLoan) {
    try {
      const receipts = await receiptService.getByKeyLoan(activeLoan.id)
      const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
      hasSignedLoanReceipt = !!(loanReceipt && loanReceipt.fileId)
    } catch {
      // If we can't fetch receipts, assume no signed receipt
      hasSignedLoanReceipt = false
    }
  }

  // Determine the availableToNextTenantFrom date
  // If there's an active loan not yet picked up, get the date from the previous loan
  // Otherwise, use the date from the current loan
  let availableFromDate = loanToCheck.availableToNextTenantFrom
  if (activeLoan && !activeLoan.pickedUpAt) {
    // Active loan not picked up - find the previous returned loan
    const previousLoan = keyLoans.find(
      (loan) => loan.id !== activeLoan.id && loan.returnedAt
    )
    if (previousLoan) {
      availableFromDate = previousLoan.availableToNextTenantFrom
    }
  }

  // Always return the contact code from the loan along with dates
  return {
    isLoaned,
    contact: loanToCheck.contact ?? null,
    matchesCurrentTenant,
    pickedUpAt: loanToCheck.pickedUpAt,
    availableToNextTenantFrom: availableFromDate,
    hasSignedLoanReceipt,
  }
}
