import { keyLoanService } from '@/services/api/keyLoanService'

export type KeyLoanInfo = {
  isLoaned: boolean
  contact: string | null
}

/**
 * Fetches all loans for a specific key and determines if it's currently loaned.
 *
 * @param keyId - The ID of the key to check
 * @param currentContact - The primary contact to compare against
 * @param currentContact2 - The secondary contact to compare against (optional)
 * @returns Object with isLoaned status and contact information
 */
export async function getKeyLoanStatus(
  keyId: string,
  currentContact?: string,
  currentContact2?: string
): Promise<KeyLoanInfo> {
  // Fetch all loans for this specific key
  const keyLoans = await keyLoanService.getByKeyId(keyId)

  // No loans at all
  if (keyLoans.length === 0) {
    return { isLoaned: false, contact: null }
  }

  // Find active loan (one without a return date)
  const activeLoan = keyLoans.find((loan) => !loan.returnedAt)

  // Use the most recent loan (first in array since ordered by createdAt DESC)
  const loanToCheck = activeLoan || keyLoans[0]
  const isLoaned = !!activeLoan

  // Check for contact match (prioritize contact over contact2)
  if (
    currentContact &&
    (loanToCheck.contact?.trim() === currentContact.trim() ||
      loanToCheck.contact2?.trim() === currentContact.trim())
  ) {
    return { isLoaned, contact: currentContact }
  }

  if (
    currentContact2 &&
    (loanToCheck.contact?.trim() === currentContact2.trim() ||
      loanToCheck.contact2?.trim() === currentContact2.trim())
  ) {
    return { isLoaned, contact: currentContact2 }
  }

  // No match - return the loan's contact
  return { isLoaned, contact: loanToCheck.contact ?? null }
}
