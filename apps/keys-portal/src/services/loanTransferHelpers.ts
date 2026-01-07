import { keyLoanService } from './api/keyLoanService'
import { keyService } from './api/keyService'
import { cardService } from './api/cardService'
import type { Key, KeyLoan, CardDetails } from './types'

export type ExistingLoanInfo = {
  loan: KeyLoan
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
    // Get all cards for this rental object first
    const allCards = await cardService.getCardsByRentalObjectCode(rentalObjectCode)

    // Get all key loans (pass cards to avoid duplicate fetch)
    const { loaned } = await keyLoanService.listByLease(
      rentalObjectCode,
      undefined, // keys will be fetched internally
      allCards
    )

    // Build a lookup map for cards
    const cardMap = new Map(allCards.map((c) => [c.cardId, c]))

    const existingLoans: ExistingLoanInfo[] = []

    for (const loan of loaned) {
      // Check if this loan matches any of the contact codes
      const matchesContact =
        (loan.contact && contactCodes.includes(loan.contact)) ||
        (loan.contact2 && contactCodes.includes(loan.contact2))

      if (!matchesContact) continue

      // Parse the keys in this loan
      let keyIds: string[] = []
      try {
        keyIds = JSON.parse(loan.keys || '[]')
      } catch {
        // Fallback to comma-separated if not JSON
        keyIds = loan.keys ? loan.keys.split(',').map((id) => id.trim()) : []
      }

      // Parse the cards in this loan
      let cardIds: string[] = []
      try {
        cardIds = JSON.parse(loan.keyCards || '[]')
      } catch {
        cardIds = []
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

      // Look up cards from the pre-fetched map
      const cards: CardDetails[] = []
      for (const cardId of cardIds) {
        const card = cardMap.get(cardId)
        if (card) {
          cards.push(card)
        } else {
          throw new Error(`Card ${cardId} not found for rental object ${rentalObjectCode}`)
        }
      }

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
