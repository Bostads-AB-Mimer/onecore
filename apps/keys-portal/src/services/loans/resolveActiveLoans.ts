/**
 * Resolves the unique active loans behind a set of selected key/card ids.
 *
 * The single home for logic that was duplicated three ways (return handler + both
 * return dialogs). Probes one item at a time and, once a loan is found, removes every
 * key/card it carries from the remaining set — so a loan is fetched at most once and
 * items already covered by a found loan are never probed again.
 */
import { keyLoanService } from '../api/keyLoanService'
import type { KeyLoanWithDetails } from '../types'

export async function resolveActiveLoansForItems(
  keyIds: string[],
  cardIds: string[]
): Promise<KeyLoanWithDetails[]> {
  const remainingKeyIds = new Set(keyIds)
  const remainingCardIds = new Set(cardIds)
  const loansById = new Map<string, KeyLoanWithDetails>()

  while (remainingKeyIds.size > 0 || remainingCardIds.size > 0) {
    const fromKeys = remainingKeyIds.size > 0
    const itemId = (fromKeys ? remainingKeyIds : remainingCardIds)
      .values()
      .next().value as string

    const loans = fromKeys
      ? await keyLoanService.getByKeyId(itemId)
      : await keyLoanService.getByCardId(itemId)
    const activeLoan = loans.find((loan) => !loan.returnedAt)

    if (activeLoan && !loansById.has(activeLoan.id)) {
      const enriched = (await keyLoanService.get(activeLoan.id, {
        includeKeySystem: true,
        includeCards: true,
      })) as KeyLoanWithDetails
      loansById.set(activeLoan.id, enriched)
      ;(enriched.keysArray ?? []).forEach((k) => remainingKeyIds.delete(k.id))
      ;(enriched.keyCardsArray ?? []).forEach((c) =>
        remainingCardIds.delete(c.cardId)
      )
    }

    // Always drop the probed id so the loop terminates even when the item has no
    // active loan, belongs to a loan we already collected, or (defensively) isn't
    // listed on its own loan's arrays.
    if (fromKeys) remainingKeyIds.delete(itemId)
    else remainingCardIds.delete(itemId)
  }

  return Array.from(loansById.values())
}
