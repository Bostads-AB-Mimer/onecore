import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import type { Card } from 'dax-client'
import * as daxService from '../dax-service'

type CardDetails = keys.v1.CardDetails
type KeyLoan = keys.v1.KeyLoan

/**
 * Database adapter functions for cards (from DAX access control system).
 * Cards don't have a local database table - they're fetched from DAX API
 * and enriched with loan information from the key_loans table.
 */

/**
 * Fetch and attach loans to cards using Knex
 * Returns a map of cardId -> loans[] for efficient lookups
 * Loans are sorted by createdAt desc
 */
export async function fetchLoansForCards(
  cards: Card[],
  dbConnection: Knex | Knex.Transaction = db
): Promise<Map<string, KeyLoan[]>> {
  const loansByCardId = new Map<string, KeyLoan[]>()

  if (cards.length === 0) return loansByCardId

  const cardIds = cards.map((c) => c.cardId)

  // Fetch all loans for these cards
  const loans = await dbConnection('key_loans')
    .whereRaw(
      `EXISTS (
      SELECT 1 FROM OPENJSON(keyCards) WHERE value IN (${cardIds.map(() => '?').join(',')})
    )`,
      cardIds
    )
    .orderBy('createdAt', 'desc')

  // Build lookup map
  loans.forEach((loan: KeyLoan) => {
    const loanCardIds = JSON.parse(loan.keyCards || '[]') as string[]
    loanCardIds.forEach((cardId) => {
      if (!loansByCardId.has(cardId)) {
        loansByCardId.set(cardId, [])
      }
      loansByCardId.get(cardId)!.push(loan)
    })
  })

  return loansByCardId
}

export interface CardIncludeOptions {
  includeLoans?: boolean
}

/**
 * Get cards for a rental object with optional loan enrichment
 *
 * This function:
 * 1. Fetches all cards from DAX API for the rental object (using nameFilter)
 * 2. Optionally enriches cards with their loan history from key_loans table
 */
export async function getCardsDetails(
  rentalObjectCode: string,
  dbConnection: Knex | Knex.Transaction = db,
  options: CardIncludeOptions = {}
): Promise<CardDetails[]> {
  const { includeLoans = false } = options

  // Step 1: Fetch cards from DAX service
  let allCards: Card[] = []
  try {
    const cardOwners = await daxService.searchCardOwners({
      nameFilter: rentalObjectCode,
      expand: 'cards',
    })

    // Extract all cards from card owners, preserving owner reference for Alliera links
    allCards = cardOwners.flatMap((owner: any) =>
      (owner.cards || []).map((card: Card) => ({
        ...card,
        owner: { cardOwnerId: owner.cardOwnerId },
      }))
    )
  } catch (error) {
    console.error('Failed to fetch cards from DAX:', error)
    return []
  }

  // If nothing to enrich or no cards, return early
  if (allCards.length === 0 || !includeLoans) {
    return allCards as CardDetails[]
  }

  // Step 2: Fetch loan data using reusable helper
  const loansByCardId = await fetchLoansForCards(allCards, dbConnection)

  // Step 3: Attach loan data to cards
  const enrichedCards = allCards.map((card) => {
    const result: any = { ...card }

    // Attach loans (active + previous, limit to 2)
    const cardLoans = loansByCardId.get(card.cardId) || []
    const activeLoan = cardLoans.find(
      (loan: KeyLoan) => loan.returnedAt === null
    )
    const returnedLoans = cardLoans.filter(
      (loan: KeyLoan) => loan.returnedAt !== null
    )

    // Include active loan + most recent previous loan
    const loansToInclude = [
      ...(activeLoan ? [activeLoan] : []),
      ...(returnedLoans.length > 0 ? [returnedLoans[0]] : []),
    ]

    result.loans = loansToInclude

    return result as CardDetails
  })

  return enrichedCards
}
