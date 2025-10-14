import { keyLoanService } from './api/keyLoanService'
import { keyService } from './api/keyService'
import type { Key, KeyLoan } from './types'

export type ExistingLoanInfo = {
  loan: KeyLoan
  keys: Key[]
  keysToTransfer: Key[] // Non-disposed keys
  disposedKeys: Key[] // Disposed keys (shown but not transferred)
}

/**
 * Find existing active loans for the given contacts on the specified rental object
 * @param contacts - Array of contact names (contact1, contact2) - matches on ANY contact
 * @param rentalObjectCode - The rental object code to check loans for
 * @returns Array of existing loan info with keys categorized
 */
export async function findExistingActiveLoansForTransfer(
  contacts: string[],
  rentalObjectCode: string
): Promise<ExistingLoanInfo[]> {
  try {
    // Get all key loans for this rental object
    const { loaned } = await keyLoanService.listByLease(rentalObjectCode)

    const existingLoans: ExistingLoanInfo[] = []

    for (const loan of loaned) {
      // Check if this loan matches any of the contacts
      const matchesContact =
        (loan.contact && contacts.includes(loan.contact)) ||
        (loan.contact2 && contacts.includes(loan.contact2))

      if (!matchesContact) continue

      // Parse the keys in this loan
      let keyIds: string[] = []
      try {
        keyIds = JSON.parse(loan.keys || '[]')
      } catch {
        // Fallback to comma-separated if not JSON
        keyIds = loan.keys ? loan.keys.split(',').map((id) => id.trim()) : []
      }

      // Fetch all keys in this loan
      const keys: Key[] = []
      for (const keyId of keyIds) {
        try {
          const key = await keyService.getKey(keyId)
          keys.push(key)
        } catch (err) {
          console.error(`Failed to fetch key ${keyId}:`, err)
        }
      }

      // Categorize keys
      const keysToTransfer = keys.filter((k) => !k.disposed)
      const disposedKeys = keys.filter((k) => k.disposed)

      existingLoans.push({
        loan,
        keys,
        keysToTransfer,
        disposedKeys,
      })
    }

    return existingLoans
  } catch (err) {
    console.error('Failed to find existing loans for transfer:', err)
    return []
  }
}
