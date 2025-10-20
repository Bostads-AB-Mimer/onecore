import { Knex } from 'knex'
import { keys } from '@onecore/types'

type KeyEvent = keys.v1.KeyEvent
type CreateKeyEventRequest = keys.v1.CreateKeyEventRequest
type UpdateKeyEventRequest = keys.v1.UpdateKeyEventRequest

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
    .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
    .orderBy('createdAt', 'desc')

  if (limit) {
    query = query.limit(limit)
  }

  return query
}

/**
 * Create a new key event.
 *
 * @param data - The key event data to insert
 * @param db - Knex instance or transaction
 * @returns The created key event
 */
export async function createKeyEvent(
  data: CreateKeyEventRequest,
  db: Knex
): Promise<KeyEvent> {
  const [row] = await db(TABLE).insert(data).returning('*')
  return row
}

/**
 * Update an existing key event.
 *
 * @param id - The key event ID to update
 * @param data - The updated key event data
 * @param db - Knex instance or transaction
 * @returns The updated key event if found, undefined otherwise
 */
export async function updateKeyEvent(
  id: string,
  data: UpdateKeyEventRequest,
  db: Knex
): Promise<KeyEvent | undefined> {
  const [row] = await db(TABLE).where({ id }).update(data).returning('*')
  return row
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

  const conflictingKeys: string[] = []

  // Check each key ID for incomplete events
  for (const keyId of keyIds) {
    const incompleteEvent = await db(TABLE)
      .select('id')
      .whereNot('status', 'COMPLETED')
      .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
      .first()

    if (incompleteEvent) {
      conflictingKeys.push(keyId)
    }
  }

  return {
    hasConflict: conflictingKeys.length > 0,
    conflictingKeys,
  }
}
