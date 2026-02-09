import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type Key = keys.v1.Key
type KeyDetails = keys.v1.KeyDetails
type KeyLoan = keys.v1.KeyLoan
type KeyEvent = keys.v1.KeyEvent
type KeySystem = keys.v1.KeySystem
type CreateKeyRequest = keys.v1.CreateKeyRequest
type UpdateKeyRequest = keys.v1.UpdateKeyRequest

const TABLE = 'keys'

/**
 * Database adapter functions for keys.
 * These functions wrap database calls to make them easier to test.
 */

/**
 * Fetch key systems for a list of keys using Knex
 * Returns a map of keySystemId -> keySystem for efficient lookups
 */
export async function fetchKeySystems(
  keys: Key[],
  dbConnection: Knex | Knex.Transaction = db
): Promise<Map<string, KeySystem>> {
  const keySystemsMap = new Map<string, KeySystem>()

  if (keys.length === 0) return keySystemsMap

  const keySystemIds = [
    ...new Set(keys.map((k) => k.keySystemId).filter(Boolean)),
  ] as string[]

  if (keySystemIds.length === 0) return keySystemsMap

  // Fetch key systems directly
  const keySystems = await dbConnection('key_systems').whereIn(
    'id',
    keySystemIds
  )

  keySystems.forEach((ks: KeySystem) => {
    keySystemsMap.set(ks.id, ks)
  })

  return keySystemsMap
}

/**
 * Fetch and attach loans to keys using Knex
 * Returns a map of keyId -> loans[] for efficient lookups
 * Loans are sorted by createdAt desc
 */
export async function fetchLoans(
  keys: Key[],
  dbConnection: Knex | Knex.Transaction = db
): Promise<Map<string, KeyLoan[]>> {
  const loansByKeyId = new Map<string, KeyLoan[]>()

  if (keys.length === 0) return loansByKeyId

  const keyIds = keys.map((k) => k.id)

  // Fetch all loans for these keys
  const loans = await dbConnection('key_loans')
    .whereRaw(
      `EXISTS (
      SELECT 1 FROM OPENJSON(keys) WHERE value IN (${keyIds.map(() => '?').join(',')})
    )`,
      keyIds
    )
    .orderBy('createdAt', 'desc')

  // Build lookup map
  loans.forEach((loan: KeyLoan) => {
    const loanKeyIds = JSON.parse(loan.keys) as string[]
    loanKeyIds.forEach((keyId) => {
      if (!loansByKeyId.has(keyId)) {
        loansByKeyId.set(keyId, [])
      }
      loansByKeyId.get(keyId)!.push(loan)
    })
  })

  return loansByKeyId
}

/**
 * Fetch and attach events to keys using Knex
 * Returns a map of keyId -> events[] for efficient lookups
 * Events are sorted by createdAt desc
 */
export async function fetchEvents(
  keys: Key[],
  dbConnection: Knex | Knex.Transaction = db
): Promise<Map<string, KeyEvent[]>> {
  const eventsByKeyId = new Map<string, KeyEvent[]>()

  if (keys.length === 0) return eventsByKeyId

  const keyIds = keys.map((k) => k.id)

  // Fetch all events for these keys
  const events = await dbConnection('key_events')
    .where(function () {
      keyIds.forEach((keyId) => {
        this.orWhere('keys', 'like', `%"${keyId}"%`)
      })
    })
    .orderBy('createdAt', 'desc')

  // Build lookup map
  events.forEach((event: KeyEvent) => {
    const eventKeyIds = JSON.parse(event.keys) as string[]
    eventKeyIds.forEach((keyId) => {
      if (!eventsByKeyId.has(keyId)) {
        eventsByKeyId.set(keyId, [])
      }
      eventsByKeyId.get(keyId)!.push(event)
    })
  })

  return eventsByKeyId
}

export async function getKeyById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getAllKeys(
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key[]> {
  return await dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

export async function getKeysByRentalObject(
  rentalObjectCode: string,
  dbConnection: Knex | Knex.Transaction = db,
  includeKeySystem = false
): Promise<Key[]> {
  const keys = await dbConnection(TABLE)
    .where({ rentalObjectCode })
    .select('*')
    .orderBy('keyName', 'asc')

  if (!includeKeySystem || keys.length === 0) {
    return keys
  }

  // Fetch key systems using the new helper
  const keySystemsById = await fetchKeySystems(keys, dbConnection)

  // Attach key systems to keys
  return keys.map((key) => ({
    ...key,
    keySystem: key.keySystemId
      ? keySystemsById.get(key.keySystemId) || null
      : null,
  }))
}

export async function createKey(
  keyData: CreateKeyRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key> {
  const [row] = await dbConnection(TABLE).insert(keyData).returning('*')
  return row
}

export async function updateKey(
  id: string,
  keyData: UpdateKeyRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...keyData, updatedAt: dbConnection.fn.now() })
    .returning('*')

  return row
}

export async function deleteKey(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

export async function bulkUpdateFlexNumber(
  rentalObjectCode: string,
  flexNumber: number,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ rentalObjectCode }).update({
    flexNumber,
    updatedAt: dbConnection.fn.now(),
  })
}

/**
 * Delete multiple keys by ID
 * @param keyIds - Array of key IDs to delete
 * @param dbConnection - Database connection
 * @returns Number of deleted keys
 */
export async function bulkDeleteKeys(
  keyIds: string[],
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  if (keyIds.length === 0) return 0
  return await dbConnection(TABLE).whereIn('id', keyIds).del()
}

/**
 * Update multiple keys by ID with the same values
 * @param keyIds - Array of key IDs to update
 * @param updates - Fields to update (flexNumber, keySystemId, rentalObjectCode, disposed)
 * @param dbConnection - Database connection
 * @returns Number of updated keys
 */
export async function bulkUpdateKeys(
  keyIds: string[],
  updates: {
    keyName?: string
    flexNumber?: number | null
    keySystemId?: string | null
    rentalObjectCode?: string
    disposed?: boolean
  },
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  if (keyIds.length === 0) return 0

  // Filter out undefined values to only update fields that are provided
  const updateData: Record<string, unknown> = {}
  if (updates.keyName !== undefined) updateData.keyName = updates.keyName
  if (updates.flexNumber !== undefined)
    updateData.flexNumber = updates.flexNumber
  if (updates.keySystemId !== undefined)
    updateData.keySystemId = updates.keySystemId
  if (updates.rentalObjectCode !== undefined)
    updateData.rentalObjectCode = updates.rentalObjectCode
  if (updates.disposed !== undefined) updateData.disposed = updates.disposed

  if (Object.keys(updateData).length === 0) return 0

  updateData.updatedAt = dbConnection.fn.now()

  return await dbConnection(TABLE).whereIn('id', keyIds).update(updateData)
}

/**
 * Options for including related data when fetching keys
 */
export interface KeyIncludeOptions {
  includeLoans?: boolean
  includeEvents?: boolean
  includeKeySystem?: boolean
}

/**
 * Core enrichment function: takes an array of keys and attaches optional related data.
 * Fetches loans, events, and key systems in parallel to avoid N+1 queries.
 */
export async function getKeyDetails(
  keys: Key[],
  dbConnection: Knex | Knex.Transaction = db,
  options: KeyIncludeOptions = {}
): Promise<KeyDetails[]> {
  const {
    includeLoans = false,
    includeEvents = false,
    includeKeySystem = false,
  } = options

  if (
    keys.length === 0 ||
    (!includeLoans && !includeEvents && !includeKeySystem)
  ) {
    return keys as KeyDetails[]
  }

  const [loansByKeyId, eventsByKeyId, keySystemsById] = await Promise.all([
    includeLoans ? fetchLoans(keys, dbConnection) : Promise.resolve(new Map()),
    includeEvents
      ? fetchEvents(keys, dbConnection)
      : Promise.resolve(new Map()),
    includeKeySystem
      ? fetchKeySystems(keys, dbConnection)
      : Promise.resolve(new Map()),
  ])

  return keys.map((key) => {
    const result: KeyDetails = { ...key } as KeyDetails

    if (includeLoans) {
      const keyLoans = loansByKeyId.get(key.id) || []
      const activeLoan = keyLoans.find(
        (loan: KeyLoan) => loan.returnedAt === null
      )
      const returnedLoans = keyLoans.filter(
        (loan: KeyLoan) => loan.returnedAt !== null
      )
      const previousLoan = returnedLoans.length > 0 ? returnedLoans[0] : null

      const loans: KeyLoan[] = []
      if (activeLoan) loans.push(activeLoan)
      if (previousLoan) loans.push(previousLoan)

      result.loans = loans.length > 0 ? loans : null
    }

    if (includeEvents) {
      const keyEvents = eventsByKeyId.get(key.id) || []
      result.events = keyEvents.length > 0 ? [keyEvents[0]] : null
    }

    if (includeKeySystem && key.keySystemId) {
      result.keySystem = keySystemsById.get(key.keySystemId) || null
    }

    return result
  })
}

/**
 * Fetch keys by rental object code and enrich with details.
 * Filters out disposed keys unless they have an active loan.
 */
export async function getKeyDetailsByRentalObject(
  rentalObjectCode: string,
  dbConnection: Knex | Knex.Transaction = db,
  options: KeyIncludeOptions = {}
): Promise<KeyDetails[]> {
  const { includeLoans = false } = options

  let keysQuery = dbConnection(TABLE).where({ rentalObjectCode }).select('*')

  if (!includeLoans) {
    keysQuery = keysQuery.where({ disposed: 0 })
  }

  const keys = await keysQuery.orderBy(['keyType', 'keySequenceNumber'])
  const details = await getKeyDetails(keys, dbConnection, options)

  if (includeLoans) {
    return details.filter(
      (d) =>
        !d.disposed ||
        (d.loans?.some((l: KeyLoan) => l.returnedAt === null) ?? false)
    )
  }

  return details
}

/**
 * Fetch keys by ID(s) and enrich with details.
 * Accepts a single key ID or an array of key IDs.
 */
export async function getKeyDetailsById(
  keyIds: string | string[],
  dbConnection: Knex | Knex.Transaction = db,
  options: KeyIncludeOptions = {}
): Promise<KeyDetails[]> {
  const ids = Array.isArray(keyIds) ? keyIds : [keyIds]
  if (ids.length === 0) return []

  const keys = await dbConnection(TABLE).whereIn('id', ids)
  return getKeyDetails(keys, dbConnection, options)
}

/**
 * Get all keys query builder for pagination
 * Returns a query builder that can be used with paginate()
 * Use fetchKeySystems() after pagination to attach key system data if needed
 * @param dbConnection - Database connection
 */
export function getAllKeysQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

/**
 * Get keys search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 * Use fetchKeySystems() after pagination to attach key system data if needed
 * @param dbConnection - Database connection
 */
export function getKeysSearchQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*')
}
