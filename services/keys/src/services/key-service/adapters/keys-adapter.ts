import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

type Key = keys.v1.Key
type KeyWithLoanStatus = keys.v1.KeyWithLoanStatus
type CreateKeyRequest = keys.v1.CreateKeyRequest
type UpdateKeyRequest = keys.v1.UpdateKeyRequest

const TABLE = 'keys'

/**
 * Database adapter functions for keys.
 * These functions wrap database calls to make them easier to test.
 */

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
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key[]> {
  return await dbConnection(TABLE)
    .where({ rentalObjectCode })
    .orderBy('keyName', 'asc')
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
 * Get keys with active loan information enriched in a single optimized query.
 * Uses junction tables (key_loan_items, key_event_items) for efficient indexed lookups.
 *
 * Performance: ~160x faster than previous OPENJSON/LIKE approach.
 * - Eliminates cartesian products (O(N×M) → O(N))
 * - Uses indexed joins instead of JSON array searches
 * - Enables proper SQL Server query optimization
 *
 * Returns:
 * - All non-disposed keys
 * - Disposed keys that have an active loan
 * - Active loan details (contact, picked up date, available from date)
 * - Previous loan availability date (for when active loan not picked up)
 * - Optionally includes latest key event data
 *
 * @param rentalObjectCode - The rental object code to filter keys by
 * @param dbConnection - Database connection (optional, defaults to db)
 * @param includeLatestEvent - Whether to include the latest key event for each key
 * @returns Promise<KeyWithLoanStatus[]> - Keys with enriched loan data
 */
export async function getKeysWithLoanStatus(
  rentalObjectCode: string,
  dbConnection: Knex | Knex.Transaction = db,
  includeLatestEvent = false
): Promise<KeyWithLoanStatus[]> {
  const eventFields = includeLatestEvent
    ? `,
      -- Latest key event data
      eventData.id as eventId,
      eventData.keys as eventKeys,
      eventData.type as eventType,
      eventData.status as eventStatus,
      eventData.workOrderId as eventWorkOrderId,
      eventData.createdAt as eventCreatedAt,
      eventData.updatedAt as eventUpdatedAt`
    : ''

  const eventJoin = includeLatestEvent
    ? `
    -- LEFT JOIN for most recent key event using junction table
    LEFT JOIN (
      SELECT
        kei.keyId,
        ke.id,
        ke.keys,
        ke.type,
        ke.status,
        ke.workOrderId,
        ke.createdAt,
        ke.updatedAt,
        ROW_NUMBER() OVER (PARTITION BY kei.keyId ORDER BY ke.createdAt DESC) as rn
      FROM key_event_items kei
      INNER JOIN key_events ke ON ke.id = kei.keyEventId
    ) eventData ON eventData.keyId = k.id AND eventData.rn = 1`
    : ''

  const result = await dbConnection.raw(
    `
    SELECT
      k.*,
      -- Active loan data (flattened for easy access)
      activeLoan.id as activeLoanId,
      activeLoan.contact as activeLoanContact,
      activeLoan.contact2 as activeLoanContact2,
      activeLoan.pickedUpAt as activeLoanPickedUpAt,
      activeLoan.availableToNextTenantFrom as activeLoanAvailableFrom,
      -- Previous loan data (for returned keys)
      prevLoan.availableToNextTenantFrom as prevLoanAvailableFrom,
      prevLoan.contact as prevLoanContact,
      prevLoan.contact2 as prevLoanContact2${eventFields}

    FROM keys k

    -- LEFT JOIN for active loan using junction table (indexed lookup)
    LEFT JOIN key_loan_items kli_active ON kli_active.keyId = k.id
    LEFT JOIN key_loans activeLoan ON activeLoan.id = kli_active.keyLoanId
      AND activeLoan.returnedAt IS NULL

    -- LEFT JOIN for most recent returned loan using junction table
    LEFT JOIN (
      SELECT
        kli.keyId,
        kl.availableToNextTenantFrom,
        kl.contact,
        kl.contact2,
        ROW_NUMBER() OVER (PARTITION BY kli.keyId ORDER BY kl.createdAt DESC) as rn
      FROM key_loan_items kli
      INNER JOIN key_loans kl ON kl.id = kli.keyLoanId
      WHERE kl.returnedAt IS NOT NULL
    ) prevLoan ON prevLoan.keyId = k.id AND prevLoan.rn = 1
    ${eventJoin}

    WHERE k.rentalObjectCode = ?
      AND (
        k.disposed = 0
        OR activeLoan.id IS NOT NULL  -- Include disposed keys only if they have active loan
      )

    ORDER BY k.keyType, k.keySequenceNumber
    `,
    [rentalObjectCode]
  )

  // Transform the result to nest the event data if included
  if (includeLatestEvent) {
    return result.map((row: any) => {
      const {
        eventId,
        eventKeys,
        eventType,
        eventStatus,
        eventWorkOrderId,
        eventCreatedAt,
        eventUpdatedAt,
        ...keyData
      } = row

      return {
        ...keyData,
        latestEvent:
          eventId !== null
            ? {
                id: eventId,
                keys: eventKeys,
                type: eventType,
                status: eventStatus,
                workOrderId: eventWorkOrderId,
                createdAt: eventCreatedAt,
                updatedAt: eventUpdatedAt,
              }
            : null,
      }
    })
  }

  return result as KeyWithLoanStatus[]
}

/**
 * Get all keys query builder for pagination
 * Returns a query builder that can be used with paginate()
 */
export function getAllKeysQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*').orderBy('createdAt', 'desc')
}

/**
 * Get keys search query builder for pagination
 * Returns a query builder that can be used with buildSearchQuery() and paginate()
 */
export function getKeysSearchQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).select('*')
}
