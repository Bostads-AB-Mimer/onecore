import { Knex } from 'knex'
import { keys } from '@onecore/types'

type Log = keys.v1.Log
type CreateLogRequest = keys.v1.CreateLogRequest

const TABLE = 'logs'

/**
 * Get all logs with pagination support.
 * Returns the most recent log per objectId, ordered by eventTime (desc).
 *
 * @param db - Knex instance or transaction
 * @returns Query builder for pagination
 */
export function getAllLogsQuery(db: Knex) {
  const subquery = db(TABLE)
    .select('*')
    .select(
      db.raw(
        'ROW_NUMBER() OVER (PARTITION BY objectId ORDER BY eventTime DESC) as rn'
      )
    )

  return db
    .from(subquery.as('ranked_logs'))
    .select('*')
    .where('rn', 1)
    .whereNotNull('objectId')
    .orderBy('eventTime', 'desc')
}

/**
 * Get a single log by ID.
 *
 * @param id - The log ID
 * @param db - Knex instance or transaction
 * @returns Log if found, undefined otherwise
 */
export async function getLogById(
  id: string,
  db: Knex
): Promise<Log | undefined> {
  return db(TABLE).where({ id }).first()
}

/**
 * Get all logs for a specific objectId, ordered by eventTime (desc).
 *
 * @param objectId - The object ID to filter by
 * @param db - Knex instance or transaction
 * @returns Array of logs for the given objectId
 */
export async function getLogsByObjectId(
  objectId: string,
  db: Knex
): Promise<Log[]> {
  return db(TABLE).where({ objectId }).orderBy('eventTime', 'desc')
}

/**
 * Create a new log entry.
 *
 * @param data - The log data to insert
 * @param db - Knex instance or transaction
 * @returns The created log
 */
export async function createLog(
  data: CreateLogRequest,
  db: Knex
): Promise<Log> {
  const [row] = await db(TABLE).insert(data).returning('*')
  return row
}

/**
 * Build a search query for logs.
 * Returns a query builder that can be used with the paginate utility.
 *
 * @param db - Knex instance or transaction
 * @returns Query builder for search with most recent per objectId logic
 */
export function getLogsSearchQuery(db: Knex) {
  const subquery = db(TABLE)
    .select('*')
    .select(
      db.raw(
        'ROW_NUMBER() OVER (PARTITION BY objectId ORDER BY eventTime DESC) as rn'
      )
    )

  return db
    .from(subquery.as('ranked_logs'))
    .select('*')
    .where('rn', 1)
    .whereNotNull('objectId')
    .orderBy('eventTime', 'desc')
}
