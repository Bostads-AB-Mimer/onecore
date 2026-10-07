import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import type { Card } from 'dax-client'
import type { CardOwner } from 'dax-client'
import * as daxAdapter from './dax-adapter'
import * as mirror from '../dax-card-owner-mirror'
import { isActiveOwner, toOwnerRows } from '../dax-card-owner-sync'
import { runWithConcurrency } from '../../../utils/concurrency'

type CardDetails = keys.CardDetails
type KeyLoan = keys.KeyLoan

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

  // Fetch all loans + their card mappings in a single query via junction table
  const rows = await dbConnection('key_loan_cards')
    .join('key_loans', 'key_loans.id', 'key_loan_cards.keyLoanId')
    .whereIn('key_loan_cards.cardId', cardIds)
    .select('key_loan_cards.cardId', 'key_loans.*')
    .orderBy('key_loans.createdAt', 'desc')

  // Build lookup map directly from joined results
  for (const row of rows) {
    const cardId = row.cardId
    if (!loansByCardId.has(cardId)) {
      loansByCardId.set(cardId, [])
    }
    loansByCardId.get(cardId)!.push(row)
  }

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
    const cardOwners = await daxAdapter.searchCardOwners({
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

/**
 * Get a single card by ID from DAX
 */
export async function getCardById(cardId: string): Promise<Card | null> {
  try {
    const card = await daxAdapter.getCardById(cardId)
    return card
  } catch (error) {
    console.error('Failed to fetch card from DAX:', error)
    return null
  }
}

const DAX_CONCURRENCY = 5
const ID_FILTER_CHUNK = 200

const withOwnerRef = (owner: CardOwner): Card[] =>
  (owner.cards || []).map((card) => ({
    ...card,
    owner: { cardOwnerId: owner.cardOwnerId },
  }))

/** nameFilter lookup for one object; returns its active owners (with cards). */
async function fetchOwnersByName(
  rentalObjectCode: string
): Promise<CardOwner[]> {
  const owners = await daxAdapter.searchCardOwners({
    nameFilter: rentalObjectCode,
    expand: 'cards',
    limit: ID_FILTER_CHUNK,
  })
  return owners.filter(isActiveOwner)
}

/**
 * Cards for many rental objects. Owner ids come from the dax_card_owners
 * mirror and are fetched with DAX idfilter in chunks of 200. Throws
 * MirrorNotReadyError until the first sync has run. An object whose
 * owner is missing or archived in the response is re-resolved with a
 * nameFilter lookup and the mirror is updated for it.
 * A failed lookup yields [] for that object.
 */
export async function getCardsByRentalObjects(
  rentalObjectCodes: string[]
): Promise<Record<string, Card[]>> {
  const result: Record<string, Card[]> = {}
  for (const code of rentalObjectCodes) result[code] = []
  if (rentalObjectCodes.length === 0) return result

  // Throws MirrorNotReadyError until the first sync has completed
  const mirrored = mirror.getOwnersForRentalObjects(rentalObjectCodes)
  const codeByOwnerId = new Map(
    mirrored.map((m) => [m.cardOwnerId, m.rentalObjectCode])
  )
  // No mirrored owner means no tags; the daily sync picks up new owners.
  // Suspects are only ids that DAX no longer returns or returns archived.
  const suspects = new Set<string>()

  const ownerIds = [...codeByOwnerId.keys()]
  const chunks: string[][] = []
  for (let i = 0; i < ownerIds.length; i += ID_FILTER_CHUNK) {
    chunks.push(ownerIds.slice(i, i + ID_FILTER_CHUNK))
  }

  await runWithConcurrency(
    chunks,
    async (chunk) => {
      let owners: CardOwner[]
      try {
        owners = await daxAdapter.searchCardOwners({
          idfilter: chunk.join(','),
          expand: 'cards',
          limit: ID_FILTER_CHUNK,
        })
      } catch (error) {
        console.error('Failed to fetch card owners by id from DAX:', error)
        chunk.forEach((id) => suspects.add(codeByOwnerId.get(id)!))
        return
      }
      const returned = new Map(owners.map((o) => [o.cardOwnerId, o]))
      for (const id of chunk) {
        const code = codeByOwnerId.get(id)!
        const owner = returned.get(id)
        if (!owner || !isActiveOwner(owner)) {
          suspects.add(code)
          continue
        }
        result[code].push(...withOwnerRef(owner))
      }
    },
    DAX_CONCURRENCY
  )

  await runWithConcurrency(
    [...suspects],
    async (code) => {
      try {
        const owners = await fetchOwnersByName(code)
        result[code] = owners.flatMap(withOwnerRef)
        mirror.replaceForRentalObject(code, toOwnerRows(owners))
      } catch (error) {
        console.error(`Failed to refresh cards from DAX for ${code}:`, error)
        result[code] = []
      }
    },
    DAX_CONCURRENCY
  )

  return result
}
