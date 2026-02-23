import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import * as daxAdapter from './dax-adapter'
import type { Card } from 'dax-client'
import { getKeyDetailsById } from './keys-adapter'

type Key = keys.Key
type KeyLoan = keys.KeyLoan
type KeyLoanWithDetails = keys.KeyLoanWithDetails
type CreateKeyLoanRequest = keys.CreateKeyLoanRequest
type UpdateKeyLoanRequest = keys.UpdateKeyLoanRequest
type Receipt = keys.Receipt

const TABLE = 'key_loans'
const KEYS_TABLE = 'keys'

/**
 * Database adapter functions for key loans.
 * These functions wrap database calls to make them easier to test.
 */

export async function getAllKeyLoans(
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  return await dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

export async function getKeyLoanById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export interface KeyLoanIncludeOptions {
  includeKeySystem?: boolean
  includeCards?: boolean
  includeLoans?: boolean
  includeEvents?: boolean
}

/**
 * Get a key loan by ID with optional enriched data
 * - includeKeySystem: fetches keys and attaches keySystem to each
 * - includeCards: fetches cards from DAX (auto-implies key fetching for rentalObjectCode)
 * - includeLoans: attaches loan history to each key
 * - includeEvents: attaches event history to each key
 */
export async function getKeyLoanByIdWithDetails(
  id: string,
  dbConnection: Knex | Knex.Transaction = db,
  options: KeyLoanIncludeOptions = {}
): Promise<KeyLoanWithDetails | undefined> {
  const loan = await dbConnection(TABLE).where({ id }).first()
  if (!loan) return undefined

  // Get key IDs from junction table
  const keyIds = (
    await dbConnection('key_loan_keys').where({ keyLoanId: id }).select('keyId')
  ).map((row) => row.keyId)

  // Fetch keys with optional enrichment using shared helper
  const keysArray = await getKeyDetailsById(keyIds, dbConnection, {
    includeKeySystem: options.includeKeySystem,
    includeLoans: options.includeLoans,
    includeEvents: options.includeEvents,
  })

  // Fetch cards from DAX if requested
  let keyCardsArray: Card[] = []
  if (options.includeCards) {
    const cardIds = (
      await dbConnection('key_loan_cards')
        .where({ keyLoanId: id })
        .select('cardId')
    ).map((row) => row.cardId)

    if (cardIds.length > 0 && keysArray.length > 0) {
      const rentalObjectCode = keysArray[0].rentalObjectCode
      if (rentalObjectCode) {
        try {
          const cardOwners = await daxAdapter.searchCardOwners({
            nameFilter: rentalObjectCode,
            expand: 'cards',
          })
          const allCards = cardOwners.flatMap((owner) => owner.cards || [])
          const cardMap = new Map(allCards.map((c) => [c.cardId, c]))
          keyCardsArray = cardIds
            .map((cid) => cardMap.get(cid))
            .filter((c): c is Card => c !== undefined)
        } catch (error) {
          console.error('Failed to fetch cards from DAX:', error)
        }
      }
    }
  }

  return {
    ...loan,
    keysArray,
    keyCardsArray,
    receipts: [],
  }
}

export async function getKeyLoansByKeyId(
  keyId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  return await dbConnection(TABLE)
    .join('key_loan_keys', `${TABLE}.id`, 'key_loan_keys.keyLoanId')
    .where('key_loan_keys.keyId', keyId)
    .select(`${TABLE}.*`)
    .orderBy(`${TABLE}.createdAt`, 'desc')
}

export async function getKeyLoansByCardId(
  cardId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  return await dbConnection(TABLE)
    .join('key_loan_cards', `${TABLE}.id`, 'key_loan_cards.keyLoanId')
    .where('key_loan_cards.cardId', cardId)
    .select(`${TABLE}.*`)
    .orderBy(`${TABLE}.createdAt`, 'desc')
}

export async function createKeyLoan(
  keyLoanData: CreateKeyLoanRequest,
  dbConnection: Knex = db
): Promise<KeyLoan> {
  const { keys: keyIds, keyCards: cardIds, ...loanData } = keyLoanData

  return dbConnection.transaction(async (trx) => {
    const [row] = await trx(TABLE).insert(loanData).returning('*')

    if (keyIds?.length) {
      const uniqueKeyIds = [...new Set(keyIds)]
      await trx('key_loan_keys').insert(
        uniqueKeyIds.map((keyId) => ({ keyLoanId: row.id, keyId }))
      )
    }

    if (cardIds?.length) {
      const uniqueCardIds = [...new Set(cardIds)]
      await trx('key_loan_cards').insert(
        uniqueCardIds.map((cardId) => ({ keyLoanId: row.id, cardId }))
      )
    }

    return row
  })
}

export async function updateKeyLoan(
  id: string,
  keyLoanData: UpdateKeyLoanRequest,
  dbConnection: Knex = db
): Promise<KeyLoan | undefined> {
  const { keys: keyIds, keyCards: cardIds, ...loanData } = keyLoanData

  return dbConnection.transaction(async (trx) => {
    const [row] = await trx(TABLE)
      .where({ id })
      .update({ ...loanData, updatedAt: trx.fn.now() })
      .returning('*')

    if (keyIds !== undefined) {
      await trx('key_loan_keys').where({ keyLoanId: id }).del()
      if (keyIds.length) {
        const uniqueKeyIds = [...new Set(keyIds)]
        await trx('key_loan_keys').insert(
          uniqueKeyIds.map((keyId) => ({ keyLoanId: id, keyId }))
        )
      }
    }

    if (cardIds !== undefined) {
      await trx('key_loan_cards').where({ keyLoanId: id }).del()
      if (cardIds.length) {
        const uniqueCardIds = [...new Set(cardIds)]
        await trx('key_loan_cards').insert(
          uniqueCardIds.map((cardId) => ({ keyLoanId: id, cardId }))
        )
      }
    }

    return row
  })
}

export async function deleteKeyLoan(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

/**
 * Check if any of the provided keys have active loans (not returned yet)
 * @param keyIds - Array of key IDs to check
 * @param excludeLoanId - Optional loan ID to exclude from the check (for updates)
 * @param dbConnection - Database connection
 * @returns Object with hasConflict flag and array of conflicting key IDs
 */
export async function checkActiveKeyLoans(
  keyIds: string[],
  excludeLoanId?: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{ hasConflict: boolean; conflictingKeys: string[] }> {
  if (keyIds.length === 0) {
    return { hasConflict: false, conflictingKeys: [] }
  }

  let query = dbConnection('key_loan_keys')
    .join(TABLE, 'key_loan_keys.keyLoanId', `${TABLE}.id`)
    .whereIn('key_loan_keys.keyId', keyIds)
    .whereNull(`${TABLE}.returnedAt`)
    .select('key_loan_keys.keyId')
    .distinct()

  if (excludeLoanId) {
    query = query.whereNot(`${TABLE}.id`, excludeLoanId)
  }

  const rows = await query
  const conflictingKeys = rows.map((r) => r.keyId)

  return {
    hasConflict: conflictingKeys.length > 0,
    conflictingKeys,
  }
}

export interface KeyLoansSearchOptions {
  /**
   * Search by key name, rental object code, contact, or contact2
   */
  keyNameOrObjectCode?: string

  /**
   * Minimum number of keys in loan
   */
  minKeys?: number

  /**
   * Maximum number of keys in loan
   */
  maxKeys?: number

  /**
   * Filter by pickedUpAt null status
   * - true: pickedUpAt IS NOT NULL
   * - false: pickedUpAt IS NULL
   * - undefined: no filter
   */
  hasPickedUp?: boolean

  /**
   * Filter by returnedAt null status
   * - true: returnedAt IS NOT NULL
   * - false: returnedAt IS NULL
   * - undefined: no filter
   */
  hasReturned?: boolean
}

/**
 * Get key loans search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 * @param options - Optional search filters
 * @param dbConnection - Database connection
 */
export function getKeyLoansSearchQuery(
  options: KeyLoansSearchOptions = {},
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  let query = dbConnection(TABLE).select(`${TABLE}.*`)

  // Filter by key name, rental object code, or contact
  if (options.keyNameOrObjectCode) {
    const searchTerm = `%${options.keyNameOrObjectCode}%`

    query = query.where(function () {
      // Search in keys via junction table (keyName or rentalObjectCode)
      this.whereRaw(
        `EXISTS (
          SELECT 1
          FROM key_loan_keys klk
          JOIN ?? k ON k.id = klk.keyId
          WHERE klk.keyLoanId = ${TABLE}.id
          AND (k.keyName LIKE ? OR k.rentalObjectCode LIKE ?)
        )`,
        [KEYS_TABLE, searchTerm, searchTerm]
      )
        // OR search in contact fields
        .orWhere(`${TABLE}.contact`, 'like', searchTerm)
        .orWhere(`${TABLE}.contact2`, 'like', searchTerm)
        .orWhere(`${TABLE}.contactPerson`, 'like', searchTerm)
    })
  }

  // Filter by minimum number of keys
  if (options.minKeys !== undefined && options.minKeys > 0) {
    query = query.whereRaw(
      `(SELECT COUNT(*) FROM key_loan_keys WHERE keyLoanId = ${TABLE}.id) >= ?`,
      [options.minKeys]
    )
  }

  // Filter by maximum number of keys
  if (options.maxKeys !== undefined && options.maxKeys > 0) {
    query = query.whereRaw(
      `(SELECT COUNT(*) FROM key_loan_keys WHERE keyLoanId = ${TABLE}.id) <= ?`,
      [options.maxKeys]
    )
  }

  // Filter by pickedUpAt null status
  if (options.hasPickedUp === true) {
    query = query.whereNotNull(`${TABLE}.pickedUpAt`)
  } else if (options.hasPickedUp === false) {
    query = query.whereNull(`${TABLE}.pickedUpAt`)
  }

  // Filter by returnedAt null status
  if (options.hasReturned === true) {
    query = query.whereNotNull(`${TABLE}.returnedAt`)
  } else if (options.hasReturned === false) {
    query = query.whereNull(`${TABLE}.returnedAt`)
  }

  return query
}

/**
 * Get enriched key loans for a rental object with keys, cards, and optionally receipts in a single optimized query.
 * This eliminates N+1 queries by fetching all data in one go.
 *
 * @param rentalObjectCode - The rental object code to filter by
 * @param contact - Optional first contact code to filter by
 * @param contact2 - Optional second contact code to filter by
 * @param includeReceipts - Whether to include receipts (default: false)
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection (optional, defaults to db)
 * @returns Promise<KeyLoanWithDetails[]> - Key loans with enriched keys, cards, and optionally receipts data
 */
export async function getKeyLoansByRentalObject(
  rentalObjectCode: string,
  contact?: string,
  contact2?: string,
  includeReceipts = false,
  returned?: boolean,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanWithDetails[]> {
  // Step 0: Fetch cards from DAX first so we can filter loans by card ownership
  let allCards: Card[] = []
  try {
    const cardOwners = await daxAdapter.searchCardOwners({
      nameFilter: rentalObjectCode,
      expand: 'cards',
    })
    allCards = cardOwners.flatMap((owner) => owner.cards || [])
  } catch (error) {
    // If DAX is unavailable, continue without cards
    console.error('Failed to fetch cards from DAX:', error)
  }

  const cardIdsForRentalObject = allCards.map((c) => c.cardId)

  // Step 1: Get all key loans for the rental object (filtered by contacts if provided)
  // This includes loans with keys from this object OR cards from this object
  let loansQuery = dbConnection('key_loans as kl')
    .select('kl.*')
    .where(function () {
      // Loans with keys from this rental object
      this.whereExists(function () {
        this.select(dbConnection.raw('1'))
          .from('key_loan_keys as klk')
          .join('keys as k', 'k.id', 'klk.keyId')
          .whereRaw('klk.keyLoanId = kl.id')
          .where('k.rentalObjectCode', rentalObjectCode)
      })
      // OR loans with cards from this rental object
      if (cardIdsForRentalObject.length > 0) {
        this.orWhereExists(function () {
          this.select(dbConnection.raw('1'))
            .from('key_loan_cards as klc')
            .whereRaw('klc.keyLoanId = kl.id')
            .whereIn('klc.cardId', cardIdsForRentalObject)
        })
      }
    })
    .orderBy('kl.createdAt', 'desc')

  // Filter by contacts: match if ANY provided contact matches EITHER kl.contact OR kl.contact2
  if (contact || contact2) {
    loansQuery = loansQuery.where(function () {
      if (contact && contact2) {
        // Both contacts provided: (kl.contact IN (c1,c2)) OR (kl.contact2 IN (c1,c2))
        this.whereIn('kl.contact', [contact, contact2]).orWhereIn(
          'kl.contact2',
          [contact, contact2]
        )
      } else if (contact) {
        // Only contact provided
        this.where('kl.contact', contact).orWhere('kl.contact2', contact)
      } else if (contact2) {
        // Only contact2 provided
        this.where('kl.contact', contact2).orWhere('kl.contact2', contact2)
      }
    })
  }

  // Filter by returned status
  if (returned === true) {
    loansQuery = loansQuery.whereNotNull('kl.returnedAt')
  } else if (returned === false) {
    loansQuery = loansQuery.whereNull('kl.returnedAt')
  }

  const loans = await loansQuery

  if (loans.length === 0) {
    return []
  }

  const loanIds = loans.map((l) => l.id)

  // Step 2: Get all keys for these loans via junction table (single query)
  const keyRows = await dbConnection('key_loan_keys')
    .join('keys', 'keys.id', 'key_loan_keys.keyId')
    .whereIn('key_loan_keys.keyLoanId', loanIds)
    .select('key_loan_keys.keyLoanId', 'keys.*')

  const keysByLoan = new Map<string, Key[]>()
  for (const row of keyRows) {
    if (!keysByLoan.has(row.keyLoanId)) keysByLoan.set(row.keyLoanId, [])
    keysByLoan.get(row.keyLoanId)!.push(row)
  }

  // Step 3: Build card map from cards fetched in Step 0
  const cardMap = new Map(allCards.map((c) => [c.cardId, c]))

  // Step 4: Get receipts for these loans (max 2 per loan: LOAN and RETURN) - only if requested
  const receiptsByLoan = new Map<string, Receipt[]>()
  if (includeReceipts) {
    const receiptsResult = await dbConnection.raw(
      `
      SELECT r.*
      FROM receipts r
      INNER JOIN (
        SELECT keyLoanId, receiptType, MAX(createdAt) as latestCreated
        FROM receipts
        WHERE keyLoanId IN (${loanIds.map(() => '?').join(',')})
        GROUP BY keyLoanId, receiptType
      ) latest ON r.keyLoanId = latest.keyLoanId
        AND r.receiptType = latest.receiptType
        AND r.createdAt = latest.latestCreated
      ORDER BY r.createdAt DESC
      `,
      loanIds
    )

    const receipts = receiptsResult as Receipt[]
    receipts.forEach((receipt) => {
      if (!receiptsByLoan.has(receipt.keyLoanId)) {
        receiptsByLoan.set(receipt.keyLoanId, [])
      }
      receiptsByLoan.get(receipt.keyLoanId)!.push(receipt)
    })
  }

  // Step 4b: Get card IDs per loan from junction table (single query)
  const cardRows = await dbConnection('key_loan_cards')
    .whereIn('keyLoanId', loanIds)
    .select('keyLoanId', 'cardId')

  const cardIdsByLoan = new Map<string, string[]>()
  for (const row of cardRows) {
    if (!cardIdsByLoan.has(row.keyLoanId)) cardIdsByLoan.set(row.keyLoanId, [])
    cardIdsByLoan.get(row.keyLoanId)!.push(row.cardId)
  }

  // Step 5: Combine everything
  return loans.map((loan) => {
    const keysArray = keysByLoan.get(loan.id) || []

    const loanCardIds = cardIdsByLoan.get(loan.id) || []
    const keyCardsArray = loanCardIds
      .map((id) => cardMap.get(id))
      .filter((c): c is Card => c !== undefined)

    const loanReceipts = receiptsByLoan.get(loan.id) || []

    return {
      ...loan,
      keysArray,
      keyCardsArray,
      receipts: loanReceipts,
    }
  })
}

/**
 * Get key loans by contact (works for both TENANT and MAINTENANCE loan types)
 * For MAINTENANCE loans, company name is stored in the contact field
 * @param contact - The contact/company name
 * @param loanType - Optional loan type filter ('TENANT' or 'MAINTENANCE')
 * @param dbConnection - Database connection
 * @returns Array of key loans
 */
export async function getKeyLoansByContact(
  contact: string,
  loanType?: 'TENANT' | 'MAINTENANCE',
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoan[]> {
  let query = dbConnection(TABLE).where({ contact })

  if (loanType) {
    query = query.where({ loanType })
  }

  return await query.orderBy('id', 'desc')
}

/**
 * Get key loans by contact with full key details
 * @param contact - The contact/company name to filter by
 * @param loanType - Optional loan type filter ('TENANT' or 'MAINTENANCE')
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection
 * @returns Array of loans with keysArray containing full key objects
 */
export async function getKeyLoansWithKeysByContact(
  contact: string,
  loanType: 'TENANT' | 'MAINTENANCE' | undefined,
  returned: boolean | undefined,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanWithDetails[]> {
  // Build base query
  let query = dbConnection(TABLE).where({ contact })

  if (loanType) {
    query = query.where({ loanType })
  }

  if (returned === true) {
    query = query.whereNotNull('returnedAt')
  } else if (returned === false) {
    query = query.whereNull('returnedAt')
  }

  const loans = await query.orderBy('id', 'desc')

  if (loans.length === 0) return []

  // Batch fetch all keys for all loans via junction table (single query)
  const loanIds = loans.map((l) => l.id)
  const keyRows = await dbConnection('key_loan_keys')
    .join(KEYS_TABLE, `${KEYS_TABLE}.id`, 'key_loan_keys.keyId')
    .whereIn('key_loan_keys.keyLoanId', loanIds)
    .select('key_loan_keys.keyLoanId', `${KEYS_TABLE}.*`)

  const keysByLoan = new Map<string, Key[]>()
  for (const row of keyRows) {
    if (!keysByLoan.has(row.keyLoanId)) keysByLoan.set(row.keyLoanId, [])
    keysByLoan.get(row.keyLoanId)!.push(row)
  }

  return loans.map((loan) => ({
    ...loan,
    keysArray: keysByLoan.get(loan.id) || [],
    keyCardsArray: [],
    receipts: [],
  })) as KeyLoanWithDetails[]
}

/**
 * Get key loans by key bundle with full key details (works for all loan types)
 * Finds all loans that contain at least one key from the specified bundle
 * @param bundleId - The key bundle ID to filter by
 * @param loanType - Optional loan type filter ('TENANT' or 'MAINTENANCE')
 * @param returned - Optional filter: true = only returned loans, false = only active loans, undefined = all loans
 * @param dbConnection - Database connection
 * @returns Array of loans with keysArray containing full key objects
 */
export async function getKeyLoansWithKeysByBundle(
  bundleId: string,
  loanType: 'TENANT' | 'MAINTENANCE' | undefined,
  returned: boolean | undefined,
  dbConnection: Knex | Knex.Transaction = db
): Promise<KeyLoanWithDetails[]> {
  // First, get the key bundle to find which keys it contains
  const bundle = await dbConnection('key_bundles')
    .where({ id: bundleId })
    .first()

  if (!bundle) {
    return []
  }

  // Get the bundle's keys from junction table
  const bundleKeyIds = (
    await dbConnection('key_bundle_keys')
      .where({ keyBundleId: bundleId })
      .select('keyId')
  ).map((r) => r.keyId)

  if (bundleKeyIds.length === 0) {
    return []
  }

  // Build base query to find loans containing any of these keys
  let query = dbConnection(TABLE)

  // Filter by loan type if specified
  if (loanType) {
    query = query.where({ loanType })
  }

  // Match loans containing any key from the bundle via junction table
  query = query.whereExists(function () {
    this.select(dbConnection.raw('1'))
      .from('key_loan_keys')
      .whereRaw(`key_loan_keys.keyLoanId = ${TABLE}.id`)
      .whereIn('key_loan_keys.keyId', bundleKeyIds)
  })

  // Apply returnedAt filter
  if (returned === true) {
    query = query.whereNotNull('returnedAt')
  } else if (returned === false) {
    query = query.whereNull('returnedAt')
  }

  const loans = await query.orderBy('id', 'desc')

  if (loans.length === 0) return []

  // Batch fetch all keys for all loans via junction table (single query)
  const loanIds = loans.map((l) => l.id)
  const keyRows = await dbConnection('key_loan_keys')
    .join(KEYS_TABLE, `${KEYS_TABLE}.id`, 'key_loan_keys.keyId')
    .whereIn('key_loan_keys.keyLoanId', loanIds)
    .select('key_loan_keys.keyLoanId', `${KEYS_TABLE}.*`)

  const keysByLoan = new Map<string, Key[]>()
  for (const row of keyRows) {
    if (!keysByLoan.has(row.keyLoanId)) keysByLoan.set(row.keyLoanId, [])
    keysByLoan.get(row.keyLoanId)!.push(row)
  }

  return loans.map((loan) => ({
    ...loan,
    keysArray: keysByLoan.get(loan.id) || [],
    keyCardsArray: [],
    receipts: [],
  })) as KeyLoanWithDetails[]
}

/**
 * Activate a key loan by setting pickedUpAt and completing any incomplete key events.
 * This is called when a LOAN receipt file is uploaded.
 *
 * @param id - The key loan ID
 * @param dbConnection - Database connection or transaction
 * @returns Activation result or null if loan not found
 */
export async function activateKeyLoan(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{ activated: boolean; keyEventsCompleted: number } | null> {
  // 1. Get the key loan
  const keyLoan = await dbConnection(TABLE).where({ id }).first()
  if (!keyLoan) {
    return null
  }

  // 2. If already activated (has pickedUpAt), return early
  if (keyLoan.pickedUpAt) {
    return { activated: false, keyEventsCompleted: 0 }
  }

  // 3. Activate in a transaction for atomicity
  const result = await dbConnection.transaction(async (trx) => {
    // Set pickedUpAt to now
    await trx(TABLE)
      .where({ id })
      .update({ pickedUpAt: trx.fn.now(), updatedAt: trx.fn.now() })

    // Complete any incomplete key events for keys in this loan
    const loanKeyIds = (
      await trx('key_loan_keys').where({ keyLoanId: id }).select('keyId')
    ).map((r) => r.keyId)

    let keyEventsCompleted = 0
    if (loanKeyIds.length > 0) {
      keyEventsCompleted = await trx('key_events')
        .whereIn('id', function () {
          this.select('keyEventId')
            .from('key_event_keys')
            .whereIn('keyId', loanKeyIds)
        })
        .whereIn('status', ['ORDERED', 'RECEIVED'])
        .update({ status: 'COMPLETED', updatedAt: trx.fn.now() })
    }

    return { keyEventsCompleted }
  })

  return { activated: true, keyEventsCompleted: result.keyEventsCompleted }
}
