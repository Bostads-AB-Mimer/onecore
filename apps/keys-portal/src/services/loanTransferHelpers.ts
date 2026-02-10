import { keyLoanService } from './api/keyLoanService'
import type { Key, KeyLoanWithDetails, CardDetails } from './types'

export type ExistingLoanInfo = {
  loan: KeyLoanWithDetails
  keys: Key[]
  keysToTransfer: Key[] // Non-disposed keys
  disposedKeys: Key[] // Disposed keys (shown but not transferred)
  cards: CardDetails[] // Cards in this loan
  cardsToTransfer: CardDetails[] // Cards to transfer (all cards for now)
}

/**
 * Find existing active loans for the given contacts on the specified rental object
 * @param contactCodes - Array of contact codes (contactCode1, contactCode2) - matches on ANY contact
 * @param rentalObjectCode - The rental object code to check loans for
 * @returns Array of existing loan info with keys categorized
 */
export async function findExistingActiveLoansForTransfer(
  contactCodes: string[],
  rentalObjectCode: string
): Promise<ExistingLoanInfo[]> {
  try {
    // Fetch active loans with full key and card details in one call
    const allLoans = await keyLoanService.getByRentalObject(
      rentalObjectCode,
      undefined,
      undefined,
      false,
      false // only active loans
    )

    const existingLoans: ExistingLoanInfo[] = []

    for (const loan of allLoans) {
      // Check if this loan matches any of the contact codes
      const matchesContact =
        (loan.contact && contactCodes.includes(loan.contact)) ||
        (loan.contact2 && contactCodes.includes(loan.contact2))

      if (!matchesContact) continue

      // Keys and cards are already enriched from the API
      const keys = (loan.keysArray || []) as Key[]
      const cards = (loan.keyCardsArray || []) as CardDetails[]

      // Categorize keys
      const keysToTransfer = keys.filter((k) => !k.disposed)
      const disposedKeys = keys.filter((k) => k.disposed)

      // All cards are transferred (no disposed state for cards)
      const cardsToTransfer = cards

      existingLoans.push({
        loan,
        keys,
        keysToTransfer,
        disposedKeys,
        cards,
        cardsToTransfer,
      })
    }

    return existingLoans
  } catch (err) {
    console.error('Failed to find existing loans for transfer:', err)
    throw err
  }
}
