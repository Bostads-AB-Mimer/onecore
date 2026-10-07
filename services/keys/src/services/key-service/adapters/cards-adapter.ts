import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import type { Card } from 'dax-client'
import type { CardOwner } from 'dax-client'
import * as daxAdapter from './dax-adapter'
import * as mirror from '../dax-card-owner-mirror'
import {
  MirrorNotReadyError,
  isActiveOwner,
  ownerBelongsTo,
  toOwnerRows,
} from '../dax-card-owner-mirror'
import { ensureSyncStarted } from '../dax-card-owner-sync'
import { chunk, logger, runWithConcurrency } from '@onecore/utilities'

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

export interface CardsBatchResult {
  cards: Record<string, Card[]>
  /** Objects whose cards could not be fetched from DAX; their status is unknown */
  unresolved: string[]
}

const withOwnerRef = (owner: CardOwner): Card[] =>
  (owner.cards || []).map((card) => ({
    ...card,
    owner: { cardOwnerId: owner.cardOwnerId },
  }))

/** nameFilter lookup for one object; active owners named by exactly that code. */
async function fetchOwnersByName(
  rentalObjectCode: string
): Promise<CardOwner[]> {
  const owners = await daxAdapter.searchCardOwners({
    nameFilter: rentalObjectCode,
    expand: 'cards',
    limit: ID_FILTER_CHUNK,
  })
  // nameFilter is a substring match: "...-P22" also returns "...-P221"
  return owners.filter(
    (o) => isActiveOwner(o) && ownerBelongsTo(o, rentalObjectCode)
  )
}

/**
 * Cards for many rental objects. Owner ids come from the in-memory
 * card-owner mirror and are fetched with DAX idfilter in chunks of 200.
 * An owner missing or archived in the response is re-resolved by name and
 * the mirror is updated for it. Objects whose DAX lookups fail are reported
 * in `unresolved` rather than guessed as having no cards.
 * Throws MirrorNotReadyError until the first sync has run.
 */
export async function getCardsByRentalObjects(
  rentalObjectCodes: string[]
): Promise<CardsBatchResult> {
  const cards: Record<string, Card[]> = {}
  for (const code of rentalObjectCodes) cards[code] = []
  const unresolved = new Set<string>()
  if (rentalObjectCodes.length === 0) return { cards, unresolved: [] }

  if (!mirror.isReady()) {
    // Boot sync failed or has not run: kick it off (no-op if running) and refuse
    ensureSyncStarted()
    throw new MirrorNotReadyError()
  }
  const mirrored = mirror.getOwnersForRentalObjects(rentalObjectCodes)
  const codeByOwnerId = new Map(
    mirrored.map((m) => [m.cardOwnerId, m.rentalObjectCode])
  )
  // No mirrored owner means no tags; the daily sync picks up new owners.
  // Suspects are only ids that DAX no longer returns or returns archived.
  const suspects = new Set<string>()

  await runWithConcurrency(
    chunk([...codeByOwnerId.keys()], ID_FILTER_CHUNK),
    async (ids) => {
      let owners: CardOwner[]
      try {
        owners = await daxAdapter.searchCardOwners({
          idfilter: ids.join(','),
          expand: 'cards',
          limit: ID_FILTER_CHUNK,
        })
      } catch (error) {
        logger.error({ error }, 'Failed to fetch card owners by id from DAX')
        ids.forEach((id) => unresolved.add(codeByOwnerId.get(id)!))
        return
      }
      const returned = new Map(owners.map((o) => [o.cardOwnerId, o]))
      for (const id of ids) {
        const code = codeByOwnerId.get(id)!
        const owner = returned.get(id)
        if (!owner || !isActiveOwner(owner)) {
          suspects.add(code)
          continue
        }
        cards[code].push(...withOwnerRef(owner))
      }
    },
    DAX_CONCURRENCY
  )

  await runWithConcurrency(
    [...suspects].filter((code) => !unresolved.has(code)),
    async (code) => {
      try {
        const owners = await fetchOwnersByName(code)
        cards[code] = owners.flatMap(withOwnerRef)
        mirror.replaceForRentalObject(code, toOwnerRows(owners))
      } catch (error) {
        logger.error(
          { error, rentalObjectCode: code },
          'Failed to refresh cards from DAX'
        )
        unresolved.add(code)
      }
    },
    DAX_CONCURRENCY
  )

  for (const code of unresolved) cards[code] = []
  return { cards, unresolved: [...unresolved] }
}
