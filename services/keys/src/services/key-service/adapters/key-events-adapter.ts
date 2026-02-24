import { Knex } from 'knex'
import { keys } from '@onecore/types'

type KeyEvent = keys.KeyEvent
type CreateKeyEventRequest = keys.CreateKeyEventRequest
type UpdateKeyEventRequest = keys.UpdateKeyEventRequest

const TABLE = 'key_events'

/**
 * Get all key events, ordered by creation date (desc).
 *
 * @param db - Knex instance or transaction
 * @returns Array of all key events
 */
export async function getAllKeyEvents(db: Knex): Promise<KeyEvent[]> {
  return db(TABLE).orderBy('createdAt', 'desc')
}

/**
 * Get a single key event by ID.
 *
 * @param id - The key event ID
 * @param db - Knex instance or transaction
 * @returns Key event if found, undefined otherwise
 */
export async function getKeyEventById(
  id: string,
  db: Knex
): Promise<KeyEvent | undefined> {
  return db(TABLE).where({ id }).first()
}

/**
 * Get all key events for a specific key.
 *
 * @param keyId - The key ID to filter by
 * @param db - Knex instance or transaction
 * @param limit - Optional limit on number of results (useful for getting just the latest event)
 * @returns Array of key events for the specified key
 */
export async function getKeyEventsByKey(
  keyId: string,
  db: Knex,
  limit?: number
): Promise<KeyEvent[]> {
  let query = db(TABLE)
    .join('key_event_keys', `${TABLE}.id`, 'key_event_keys.keyEventId')
    .where('key_event_keys.keyId', keyId)
    .select(`${TABLE}.*`)
    .orderBy(`${TABLE}.createdAt`, 'desc')

  if (limit) {
    query = query.limit(limit)
  }

  return query
}

/**
 * Create a new key event.
 *
 * @param data - The key event data to insert
 * @param db - Knex instance
 * @returns The created key event
 */
export async function createKeyEvent(
  data: CreateKeyEventRequest,
  db: Knex
): Promise<KeyEvent> {
  const { keys: keyIds, ...eventData } = data

  return db.transaction(async (trx) => {
    const [row] = await trx(TABLE).insert(eventData).returning('*')

    if (keyIds?.length) {
      const uniqueKeyIds = [...new Set(keyIds)]
      await trx('key_event_keys').insert(
        uniqueKeyIds.map((keyId) => ({ keyEventId: row.id, keyId }))
      )
    }

    return row
  })
}

/**
 * Update an existing key event.
 *
 * @param id - The key event ID to update
 * @param data - The updated key event data
 * @param db - Knex instance
 * @returns The updated key event if found, undefined otherwise
 */
export async function updateKeyEvent(
  id: string,
  data: UpdateKeyEventRequest,
  db: Knex
): Promise<KeyEvent | undefined> {
  const { keys: keyIds, ...eventData } = data

  return db.transaction(async (trx) => {
    const [row] = await trx(TABLE)
      .where({ id })
      .update({ ...eventData, updatedAt: trx.fn.now() })
      .returning('*')

    if (keyIds !== undefined) {
      await trx('key_event_keys').where({ keyEventId: id }).del()
      if (keyIds.length) {
        const uniqueKeyIds = [...new Set(keyIds)]
        await trx('key_event_keys').insert(
          uniqueKeyIds.map((keyId) => ({ keyEventId: id, keyId }))
        )
      }
    }

    return row
  })
}

/**
 * Check if any of the provided keys have incomplete events (status not COMPLETED)
 * @param keyIds - Array of key IDs to check
 * @param db - Knex instance or transaction
 * @returns Object with hasConflict flag and array of conflicting key IDs
 */
export async function checkIncompleteKeyEvents(
  keyIds: string[],
  db: Knex
): Promise<{ hasConflict: boolean; conflictingKeys: string[] }> {
  if (keyIds.length === 0) {
    return { hasConflict: false, conflictingKeys: [] }
  }

  const rows = await db('key_event_keys')
    .join(TABLE, `${TABLE}.id`, 'key_event_keys.keyEventId')
    .whereIn('key_event_keys.keyId', keyIds)
    .whereNot(`${TABLE}.status`, 'COMPLETED')
    .select('key_event_keys.keyId')
    .distinct()

  const conflictingKeys = rows.map((r) => r.keyId)

  return {
    hasConflict: conflictingKeys.length > 0,
    conflictingKeys,
  }
}
