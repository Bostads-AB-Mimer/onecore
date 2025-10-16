import { keyLoanService } from '@/services/api/keyLoanService'

export type KeyLoanInfo = {
  isLoaned: boolean
  contact: string | null // The contact code from the loan
  matchesCurrentTenant: boolean // Whether this loan matches the current tenant
  pickedUpAt?: string // When the key was picked up (for loaned keys)
  availableToNextTenantFrom?: string // When the key becomes available (for returned keys)
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

  // Always return the contact code from the loan along with dates
  return {
    isLoaned,
    contact: loanToCheck.contact ?? null,
    matchesCurrentTenant,
    pickedUpAt: loanToCheck.pickedUpAt,
    availableToNextTenantFrom: loanToCheck.availableToNextTenantFrom,
  }
}
