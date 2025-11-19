import { Knex } from 'knex'
import { keys } from '@onecore/types'
import { logger } from '@onecore/utilities'

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
    .innerJoin(db.raw(`keys ON keys.id = JSON_VALUE(kl.keys, '$[0]')`))
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
    .innerJoin(db.raw(`keys ON keys.id = JSON_VALUE(kl.keys, '$[0]')`))
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
    .innerJoin(db.raw(`keys ON keys.id = JSON_VALUE(ke.keys, '$[0]')`))
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
    .innerJoin(db.raw(`keys ON keys.id = JSON_VALUE(kb.keys, '$[0]')`))
    .where('keys.rentalObjectCode', rentalObjectCode)

  // 7. objectType='signature' - Via receipt → keyLoan chain
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
    .innerJoin(db.raw(`keys ON keys.id = JSON_VALUE(kl.keys, '$[0]')`))
    .where('keys.rentalObjectCode', rentalObjectCode)

  // NOTE: objectType='keySystem' is explicitly excluded - keySystem logs are
  // infrastructure-level and don't have a single rental object relationship

  // 8. Fallback: Search description for rental object code
  // This catches logs where the related entity was deleted (INNER JOINs fail for deleted entities)
  // We exclude logs already found by other queries to avoid duplicates
  const descriptionFallback = db(`${TABLE} as logs`)
    .select('logs.*')
    .where('logs.description', 'like', `%${rentalObjectCode}%`)
    .whereNotExists(function () {
      // Exclude logs that would be found by the key query (if key still exists)
      this.select(db.raw(1))
        .from('keys')
        .whereRaw('logs.objectId = keys.id')
        .andWhereRaw("logs.objectType = 'key'")
        .andWhere('keys.rentalObjectCode', rentalObjectCode)
    })

  // UNION all queries and sort by eventTime
  return db
    .unionAll([
      keyLogs,
      keyLoanLogs,
      receiptLogs,
      keyEventLogs,
      keyNoteLogs,
      keyBundleLogs,
      signatureLogs,
      descriptionFallback,
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
 * - keyEvent, keyBundle, keyNote, keySystem
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
        .whereNull('kl.returnedAt') // Only active loans
    })

  // NOTE: Other objectTypes (keyEvent, keyBundle, keyNote, keySystem)
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

/**
 * Get list of unique users who have created logs.
 * Used for populating user filter dropdowns in the frontend.
 *
 * @param db - Knex instance or transaction
 * @returns Array of unique usernames sorted alphabetically
 */
export async function getUniqueUsers(db: Knex): Promise<string[]> {
  const rows = await db(TABLE)
    .distinct('userName')
    .whereNotNull('userName')
    .orderBy('userName', 'asc')

  return rows.map((row: any) => row.userName)
}

/**
 * Translation mappings for Swedish labels.
 * Provides single source of truth for all log-related translations.
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  creation: 'Skapad',
  update: 'Uppdaterad',
  delete: 'Raderad',
}

const OBJECT_TYPE_LABELS: Record<string, string> = {
  key: 'Nyckel',
  keySystem: 'Nyckelsystem',
  keyLoan: 'Nyckellån',
  keyBundle: 'Nyckelsamling',
  receipt: 'Kvitto',
  keyEvent: 'Nyckelhändelse',
  signature: 'Signatur',
  keyNote: 'Nyckelanteckning',
}

/**
 * Enriches a log object with Swedish labels for eventType and objectType.
 * This provides i18n support and eliminates the need for frontend translation dictionaries.
 *
 * @param row - Raw log data from database
 * @returns Log object with eventTypeLabel and objectTypeLabel fields added
 */
export function enrichLogWithLabels(row: any): Log {
  return {
    ...row,
    eventTypeLabel: EVENT_TYPE_LABELS[row.eventType] || row.eventType,
    objectTypeLabel: OBJECT_TYPE_LABELS[row.objectType] || row.objectType,
  }
}

/**
 * Build description for key log entries.
 * Uses direct DB queries instead of HTTP calls to core service.
 *
 * @param key - Key entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @param db - Knex instance or transaction
 * @returns Swedish description string
 */
export async function buildKeyDescription(
  key: {
    id: string
    keyName: string
    keySequenceNumber?: number
    rentalObjectCode?: string
    keyType: string
    flexNumber?: number | null
    keySystemId?: string | null
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad',
  db: Knex
): Promise<string> {
  const parts: string[] = [`${action} nyckel`]

  // Key name with sequence number
  const keyName = key.keySequenceNumber
    ? `${key.keyName} ${key.keySequenceNumber}`
    : key.keyName
  parts.push(keyName)

  // Add rental object code
  if (key.rentalObjectCode) {
    parts.push(`för ${key.rentalObjectCode}`)
  }

  // Add key type
  parts.push(`typ: ${key.keyType}`)

  // Add flex number if present
  if (key.flexNumber) {
    parts.push(`flex: ${key.flexNumber}`)
  }

  // Add key system if present (DIRECT DB QUERY instead of HTTP call)
  if (key.keySystemId) {
    try {
      const keySystem = await db('key_systems')
        .where({ id: key.keySystemId })
        .select('systemCode')
        .first()

      if (keySystem) {
        parts.push(`system: ${keySystem.systemCode}`)
      }
    } catch (error) {
      logger.warn(
        { error, keySystemId: key.keySystemId },
        'Failed to fetch key system for log description'
      )
    }
  }

  return parts.join(', ')
}

/**
 * Build description for key system log entries.
 * Pure function - no DB queries needed.
 *
 * @param keySystem - Key system entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @returns Swedish description string
 */
export function buildKeySystemDescription(
  keySystem: {
    systemCode: string
    name: string
    manufacturer: string
    type: 'MECHANICAL' | 'ELECTRONIC' | 'HYBRID'
    propertyIds?: string
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad'
): string {
  const parts: string[] = [`${action} nyckelsystem`]

  // System code and name
  parts.push(`${keySystem.systemCode} (${keySystem.name})`)

  // Add manufacturer
  parts.push(`tillverkare: ${keySystem.manufacturer}`)

  // Add type with Swedish translation
  const typeLabels = {
    MECHANICAL: 'Mekaniskt',
    ELECTRONIC: 'Elektroniskt',
    HYBRID: 'Hybrid',
  }
  parts.push(`typ: ${typeLabels[keySystem.type]}`)

  // Add property count if available
  if (keySystem.propertyIds) {
    try {
      const propertyCount = JSON.parse(keySystem.propertyIds).length
      parts.push(
        `${propertyCount} ${propertyCount === 1 ? 'fastighet' : 'fastigheter'}`
      )
    } catch (_error) {
      // If parsing fails, skip property count
    }
  }

  return parts.join(', ')
}

/**
 * Build description for receipt log entries.
 * Uses direct DB queries instead of HTTP calls to core service.
 *
 * @param receipt - Receipt entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @param db - Knex instance or transaction
 * @returns Swedish description string
 */
export async function buildReceiptDescription(
  receipt: {
    id: string
    keyLoanId: string
    receiptType: 'LOAN' | 'RETURN'
    type: 'DIGITAL' | 'PHYSICAL'
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad',
  db: Knex
): Promise<string> {
  const parts: string[] = [`${action}`]

  // Receipt type
  const typeLabel =
    receipt.receiptType === 'LOAN' ? 'utlånings' : 'återlämnings'
  parts.push(`${typeLabel}kvitto`)

  // Format
  const formatLabel = receipt.type === 'DIGITAL' ? 'digitalt' : 'fysiskt'
  parts.push(`(${formatLabel})`)

  // Fetch key loan details for context (DIRECT DB QUERY)
  try {
    const loan = await db('key_loans')
      .where({ id: receipt.keyLoanId })
      .select('contact', 'keys')
      .first()

    if (loan) {
      // Add contact
      if (loan.contact) {
        parts.push(`för ${loan.contact}`)
      }

      // Add key count
      try {
        const keyIds = JSON.parse(loan.keys)
        const keyCount = Array.isArray(keyIds) ? keyIds.length : 0
        parts.push(`${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}`)
      } catch (_error) {
        // Skip if parsing fails
      }
    }
  } catch (error) {
    logger.warn(
      { error, keyLoanId: receipt.keyLoanId },
      'Failed to fetch key loan for receipt log description'
    )
  }

  return parts.join(', ')
}

/**
 * Build description for signature log entries.
 * Pure function - no DB queries needed.
 *
 * @param signature - Signature entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @returns Swedish description string
 */
export function buildSignatureDescription(
  signature: {
    resourceType: string
    resourceId: string
    recipientEmail: string
    recipientName?: string | null
    simpleSignDocumentId: number
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad'
): string {
  const parts: string[] = [action]

  // Resource type
  const resourceTypeLabel =
    signature.resourceType === 'receipt' ? 'kvitto' : signature.resourceType
  parts.push(`signaturförfrågan för ${resourceTypeLabel}`)

  // Recipient
  if (signature.recipientName) {
    parts.push(`till ${signature.recipientName} (${signature.recipientEmail})`)
  } else {
    parts.push(`till ${signature.recipientEmail}`)
  }

  // Document ID
  parts.push(`dokument-ID: ${signature.simpleSignDocumentId}`)

  return parts.join(', ')
}

/**
 * Build description for key bundle log entries.
 * Uses direct DB queries instead of HTTP calls to core service.
 *
 * @param bundle - Key bundle entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @param db - Knex instance or transaction
 * @returns Swedish description string
 */
export async function buildKeyBundleDescription(
  bundle: {
    id: string
    name: string
    keys: string
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad',
  db: Knex
): Promise<string> {
  const parts: string[] = [`${action} nyckelknippa`]

  // Bundle name
  parts.push(`"${bundle.name}"`)

  // Key count and names
  try {
    const keyIds = JSON.parse(bundle.keys)
    const keyCount = Array.isArray(keyIds) ? keyIds.length : 0
    parts.push(`${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}`)

    // Only fetch key names if 5 or fewer keys (DIRECT DB QUERY)
    if (Array.isArray(keyIds) && keyIds.length > 0 && keyIds.length <= 5) {
      const keys = await db('keys')
        .whereIn('id', keyIds)
        .select('keyName', 'keySequenceNumber')

      const keyNames = keys
        .map((key: any) => {
          return key.keySequenceNumber
            ? `${key.keyName} ${key.keySequenceNumber}`
            : key.keyName
        })
        .filter((name) => name !== '')

      if (keyNames.length > 0) {
        parts.push(`(${keyNames.join(', ')})`)
      }
    }
  } catch (error) {
    logger.warn(
      { error, bundleId: bundle.id },
      'Failed to parse keys for bundle log description'
    )
  }

  return parts.join(', ')
}

/**
 * Build description for key loan log entries.
 * Uses direct DB queries instead of HTTP calls to core service.
 *
 * @param keyLoan - Key loan entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @param db - Knex instance or transaction
 * @returns Swedish description string
 */
export async function buildKeyLoanDescription(
  keyLoan: {
    contact?: string
    keys: string
    lease?: string
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad',
  db: Knex
): Promise<string> {
  const parts: string[] = [`${action} nyckellån`]

  // Add contact code to description
  if (keyLoan.contact) {
    parts.push(`för kontakt ${keyLoan.contact}`)
  }

  // Fetch key names from key IDs (DIRECT DB QUERY)
  try {
    const keyIds = JSON.parse(keyLoan.keys) as string[]
    if (Array.isArray(keyIds) && keyIds.length > 0) {
      const keys = await db('keys')
        .whereIn('id', keyIds)
        .select('keyName', 'keySequenceNumber')

      const keyNames = keys
        .map((key: any) => {
          return key.keySequenceNumber
            ? `${key.keyName} ${key.keySequenceNumber}`
            : key.keyName
        })
        .filter((name) => name !== '')

      if (keyNames.length > 0) {
        parts.push(`nycklar: ${keyNames.join(', ')}`)
      }
    }
  } catch (error) {
    logger.warn(
      { error, keyLoanKeys: keyLoan.keys },
      'Failed to fetch keys for loan log description'
    )
  }

  if (keyLoan.lease) {
    parts.push(`avtal: ${keyLoan.lease}`)
  }

  return parts.join(', ')
}

/**
 * Build description for key note log entries.
 * Pure function - no DB queries needed.
 *
 * @param keyNote - Key note entity data
 * @param action - Swedish action label (Skapad, Uppdaterad, Kasserad, Raderad)
 * @returns Swedish description string
 */
export function buildKeyNoteDescription(
  keyNote: {
    rentalObjectCode: string
    description: string
  },
  action: 'Skapad' | 'Uppdaterad' | 'Kasserad' | 'Raderad'
): string {
  const parts: string[] = [
    `${action} Nyckelanteckning för ${keyNote.rentalObjectCode}`,
  ]

  // Truncate description to ~50 chars for preview
  if (keyNote.description) {
    const descriptionPreview =
      keyNote.description.length > 50
        ? keyNote.description.substring(0, 50) + '...'
        : keyNote.description
    parts.push(`"${descriptionPreview}"`)
  }

  return parts.join(': ')
}
