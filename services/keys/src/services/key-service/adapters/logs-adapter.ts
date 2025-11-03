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

/**
 * Get all logs for a specific rental object code using JOINs.
 *
 * This function builds a UNION query across all objectTypes to find logs
 * related to a rental object. Each objectType has a different JOIN path
 * to reach the keys table and its rentalObjectCode field.
 *
 * JOIN paths:
 * - key: logs → keys (direct)
 * - keyLoan: logs → key_loans → extract first key from JSON → keys
 * - receipt: logs → receipts → key_loans → extract first key → keys
 * - keyEvent: logs → key_events → extract first key from JSON → keys
 * - keyNote: logs → key_notes (direct rentalObjectCode field)
 * - keyBundle: logs → key_bundles → extract first key from JSON → keys
 * - keyLoanMaintenanceKeys: logs → key_loan_maintenance_keys → extract first key → keys
 * - signature: logs → signatures → receipts → key_loans → extract first key → keys
 * - keySystem: EXCLUDED (infrastructure-level, no single rental object relationship)
 *
 * Performance: ~100-500ms with JSON parsing (current), ~20-90ms after MIM-901 junction tables
 *
 * @param rentalObjectCode - The rental object code to filter by (e.g., "705-011-03-0102")
 * @param db - Knex instance or transaction
 * @returns Query builder for pagination
 */
export function getLogsByRentalObjectCodeQuery(
  rentalObjectCode: string,
  db: Knex
) {
  // 1. objectType='key' - Direct JOIN to keys table
  const keyLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('keys', function () {
      this.on('logs.objectId', '=', 'keys.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['key'])
      )
    })
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 2. objectType='keyLoan' - Extract first key from JSON array
  const keyLoanLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('key_loans as kl', function () {
      this.on('logs.objectId', '=', 'kl.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['keyLoan'])
      )
    })
    .innerJoin(
      db.raw(`keys ON keys.id = JSON_VALUE(kl.keys, '$[0]')`)
    )
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 3. objectType='receipt' - Via keyLoan chain
  const receiptLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('receipts as r', function () {
      this.on('logs.objectId', '=', 'r.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['receipt'])
      )
    })
    .innerJoin('key_loans as kl', 'r.keyLoanId', 'kl.id')
    .innerJoin(
      db.raw(`keys ON keys.id = JSON_VALUE(kl.keys, '$[0]')`)
    )
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 4. objectType='keyEvent' - Extract first key from JSON
  const keyEventLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('key_events as ke', function () {
      this.on('logs.objectId', '=', 'ke.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['keyEvent'])
      )
    })
    .innerJoin(
      db.raw(`keys ON keys.id = JSON_VALUE(ke.keys, '$[0]')`)
    )
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 5. objectType='keyNote' - Direct rentalObjectCode field
  const keyNoteLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('key_notes as kn', function () {
      this.on('logs.objectId', '=', 'kn.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['keyNote'])
      )
    })
    .where('kn.rentalObjectCode', rentalObjectCode)

  // 6. objectType='keyBundle' - Extract first key from JSON
  const keyBundleLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('key_bundles as kb', function () {
      this.on('logs.objectId', '=', 'kb.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['keyBundle'])
      )
    })
    .innerJoin(
      db.raw(`keys ON keys.id = JSON_VALUE(kb.keys, '$[0]')`)
    )
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 7. objectType='keyLoanMaintenanceKeys' - Extract first key from JSON
  const maintenanceLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('key_loan_maintenance_keys as klmk', function () {
      this.on('logs.objectId', '=', 'klmk.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['keyLoanMaintenanceKeys'])
      )
    })
    .innerJoin(
      db.raw(`keys ON keys.id = JSON_VALUE(klmk.keys, '$[0]')`)
    )
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 8. objectType='signature' - Via receipt → keyLoan chain
  const signatureLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('signatures as s', function () {
      this.on('logs.objectId', '=', 's.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['signature'])
      )
    })
    .innerJoin('receipts as r', function () {
      this.on('s.resourceId', '=', 'r.id').andOn(
        's.resourceType',
        '=',
        db.raw('?', ['receipt'])
      )
    })
    .innerJoin('key_loans as kl', 'r.keyLoanId', 'kl.id')
    .innerJoin(
      db.raw(`keys ON keys.id = JSON_VALUE(kl.keys, '$[0]')`)
    )
    .where('keys.rentalObjectCode', rentalObjectCode)

  // NOTE: objectType='keySystem' is explicitly excluded - keySystem logs are
  // infrastructure-level and don't have a single rental object relationship

  // UNION all queries and sort by eventTime
  return db
    .unionAll([
      keyLogs,
      keyLoanLogs,
      receiptLogs,
      keyEventLogs,
      keyNoteLogs,
      keyBundleLogs,
      maintenanceLogs,
      signatureLogs,
    ])
    .orderBy('eventTime', 'desc')
}

/**
 * Get all logs for a specific contact using JOINs.
 *
 * This function builds a UNION query across objectTypes that have contact relationships.
 * Only certain objectTypes can be linked to a contact (tenant/person).
 *
 * JOIN paths:
 * - keyLoan: logs → key_loans → contact/contact2 fields (direct)
 * - receipt: logs → receipts → key_loans → contact/contact2
 * - signature: logs → signatures → receipts → key_loans → contact/contact2
 * - key: logs → keys → find active loans → contact/contact2 (complex)
 *
 * Excluded objectTypes (no contact relationship):
 * - keyEvent, keyBundle, keyNote, keySystem, keyLoanMaintenanceKeys
 *
 * Note: Matches both contact and contact2 fields (co-tenants supported)
 *
 * @param contactId - The contact code to filter by (e.g., "P079586", "F123456")
 * @param db - Knex instance or transaction
 * @returns Query builder for pagination
 */
export function getLogsByContactIdQuery(contactId: string, db: Knex) {
  // 1. objectType='keyLoan' - Direct contact field
  const keyLoanLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('key_loans as kl', function () {
      this.on('logs.objectId', '=', 'kl.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['keyLoan'])
      )
    })
    .where(function () {
      this.where('kl.contact', contactId).orWhere('kl.contact2', contactId)
    })

  // 2. objectType='receipt' - Via keyLoan
  const receiptLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('receipts as r', function () {
      this.on('logs.objectId', '=', 'r.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['receipt'])
      )
    })
    .innerJoin('key_loans as kl', 'r.keyLoanId', 'kl.id')
    .where(function () {
      this.where('kl.contact', contactId).orWhere('kl.contact2', contactId)
    })

  // 3. objectType='signature' - Via receipt → keyLoan
  const signatureLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('signatures as s', function () {
      this.on('logs.objectId', '=', 's.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['signature'])
      )
    })
    .innerJoin('receipts as r', function () {
      this.on('s.resourceId', '=', 'r.id').andOn(
        's.resourceType',
        '=',
        db.raw('?', ['receipt'])
      )
    })
    .innerJoin('key_loans as kl', 'r.keyLoanId', 'kl.id')
    .where(function () {
      this.where('kl.contact', contactId).orWhere('kl.contact2', contactId)
    })

  // 4. objectType='key' - Find keys that are in active loans for this contact
  // This uses LIKE pattern to search for key ID in JSON array
  const keyLogs = db(`${TABLE} as logs`)
    .select('logs.*')
    .innerJoin('keys as k', function () {
      this.on('logs.objectId', '=', 'k.id').andOn(
        'logs.objectType',
        '=',
        db.raw('?', ['key'])
      )
    })
    .whereExists(function () {
      this.select('*')
        .from('key_loans as kl')
        .whereRaw(`kl.keys LIKE '%"' + CAST(k.id AS NVARCHAR(36)) + '"%'`)
        .andWhere(function () {
          this.where('kl.contact', contactId).orWhere('kl.contact2', contactId)
        })
        .andWhereNull('kl.returnedAt') // Only active loans
    })

  // NOTE: Other objectTypes (keyEvent, keyBundle, keyNote, keySystem, keyLoanMaintenanceKeys)
  // don't have contact relationships and are excluded

  // UNION all queries and sort by eventTime
  return db
    .unionAll([keyLoanLogs, receiptLogs, signatureLogs, keyLogs])
    .orderBy('eventTime', 'desc')
}

/**
 * Get all logs with key_events joined for grouping flex/order/lost operations.
 * Returns ALL logs chronologically (no filtering by objectId).
 * Use this for Activity Log page to show complete event history.
 *
 * @param db - Knex instance or transaction
 * @returns Query builder for pagination
 */
export function getAllLogsWithKeyEventsQuery(db: Knex) {
  const logsWithEvents = db
    .raw(
      `
    SELECT
      logs.*,
      -- Join with key_events to group flex/order/lost operations
      key_events.id as keyEventId,
      key_events.type as keyEventType,
      key_events.status as keyEventStatus,
      key_events.workOrderId as keyEventWorkOrderId
    FROM logs
    OUTER APPLY (
      SELECT TOP 1 id, type, status, workOrderId
      FROM key_events ke
      WHERE
        logs.objectType = 'key'
        AND ke.keys LIKE '%"' + CAST(logs.objectId AS NVARCHAR(36)) + '"%'
      ORDER BY ke.createdAt DESC
    ) key_events
  `
    )
    .wrap('(', ') as logs_with_events')

  return db.from(logsWithEvents).select('*').orderBy('eventTime', 'desc')
}
