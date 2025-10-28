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
  // Exclude batchId from database insert - it's only for logging purposes
  const { batchId, ...dbFields } = keyData
  const [row] = await dbConnection(TABLE).insert(dbFields).returning('*')
  return row
}

export async function updateKey(
  id: string,
  keyData: UpdateKeyRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Key | undefined> {
  // Exclude batchId from database update - it's only for logging purposes
  const { batchId, ...dbFields } = keyData
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...dbFields, updatedAt: dbConnection.fn.now() })
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
 * This eliminates N+1 queries by using LEFT JOINs and OUTER APPLY.
 *
 * Performance: ~95% faster than fetching keys then looping to get loan status.
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
      event.id as eventId,
      event.keys as eventKeys,
      event.type as eventType,
      event.status as eventStatus,
      event.workOrderId as eventWorkOrderId,
      event.createdAt as eventCreatedAt,
      event.updatedAt as eventUpdatedAt`
    : ''

  const eventJoin = includeLatestEvent
    ? `
    -- OUTER APPLY for most recent key event
    OUTER APPLY (
      SELECT TOP 1
        id,
        keys,
        type,
        status,
        workOrderId,
        createdAt,
        updatedAt
      FROM key_events ke
      WHERE ke.keys LIKE '%"' + CAST(k.id AS NVARCHAR(36)) + '"%'
      ORDER BY ke.createdAt DESC
    ) event`
    : ''

  const result = await dbConnection.raw(
    `
    SELECT
      k.*,
      -- Active loan data (flattened for easy access)
      kl.id as activeLoanId,
      kl.contact as activeLoanContact,
      kl.contact2 as activeLoanContact2,
      kl.pickedUpAt as activeLoanPickedUpAt,
      kl.availableToNextTenantFrom as activeLoanAvailableFrom,
      -- Previous loan data (for returned keys)
      prev.availableToNextTenantFrom as prevLoanAvailableFrom,
      prev.contact as prevLoanContact,
      prev.contact2 as prevLoanContact2${eventFields}

    FROM keys k

    -- LEFT JOIN active loan (only ONE per key since returnedAt IS NULL)
    LEFT JOIN key_loans kl ON (
      EXISTS (
        SELECT 1
        FROM OPENJSON(kl.keys)
        WHERE value = CAST(k.id AS NVARCHAR(36))
      )
      AND kl.returnedAt IS NULL
    )

    -- OUTER APPLY for most recent returned loan data
    -- OUTER APPLY is SQL Server's equivalent to Postgres LATERAL
    OUTER APPLY (
      SELECT TOP 1
        availableToNextTenantFrom,
        contact,
        contact2
      FROM key_loans kl2
      WHERE EXISTS (
        SELECT 1
        FROM OPENJSON(kl2.keys)
        WHERE value = CAST(k.id AS NVARCHAR(36))
      )
      AND kl2.returnedAt IS NOT NULL
      ORDER BY kl2.createdAt DESC
    ) prev
    ${eventJoin}

    WHERE k.rentalObjectCode = ?
      AND (
        k.disposed = 0
        OR kl.id IS NOT NULL  -- Include disposed keys only if they have active loan
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
