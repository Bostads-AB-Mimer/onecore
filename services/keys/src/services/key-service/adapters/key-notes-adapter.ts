import { Knex } from 'knex'
import { keys } from '@onecore/types'

type KeyNote = keys.v1.KeyNote
type CreateKeyNoteRequest = keys.v1.CreateKeyNoteRequest
type UpdateKeyNoteRequest = keys.v1.UpdateKeyNoteRequest

const TABLE = 'key_notes'

/**
 * Get all key notes by rental object code, ordered by ID (desc).
 *
 * @param rentalObjectCode - The rental object code to filter by
 * @param db - Knex instance or transaction
 * @returns Array of key notes for the given rental object
 */
export async function getKeyNotesByRentalObject(
  rentalObjectCode: string,
  db: Knex
): Promise<KeyNote[]> {
  return db(TABLE).where({ rentalObjectCode }).orderBy('id', 'desc')
}

/**
 * Get a single key note by ID.
 *
 * @param id - The key note ID
 * @param db - Knex instance or transaction
 * @returns Key note if found, undefined otherwise
 */
export async function getKeyNoteById(
  id: string,
  db: Knex
): Promise<KeyNote | undefined> {
  return db(TABLE).where({ id }).first()
}

/**
 * Create a new key note.
 *
 * @param data - The key note data to insert
 * @param db - Knex instance or transaction
 * @returns The created key note
 */
export async function createKeyNote(
  data: CreateKeyNoteRequest,
  db: Knex
): Promise<KeyNote> {
  const [row] = await db(TABLE).insert(data).returning('*')
  return row
}

/**
 * Update an existing key note.
 *
 * @param id - The key note ID to update
 * @param data - The updated key note data
 * @param db - Knex instance or transaction
 * @returns The updated key note if found, undefined otherwise
 */
export async function updateKeyNote(
  id: string,
  data: UpdateKeyNoteRequest,
  db: Knex
): Promise<KeyNote | undefined> {
  const [row] = await db(TABLE).where({ id }).update(data).returning('*')
  return row
}
