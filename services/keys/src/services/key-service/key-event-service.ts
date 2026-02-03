/**
 * Business logic service for key event validation
 *
 * This service handles validation logic for creating key events:
 * 1. Parse and validate keys (can be JSON array or single string)
 * 2. Check for incomplete event conflicts (keys with incomplete events)
 * 3. Ensure keys array is not empty
 *
 * This extracts business logic from route handlers for better testability
 * and maintainability.
 */

import { Knex } from 'knex'
import * as keyEventsAdapter from './adapters/key-events-adapter'

export type KeyEventValidationError =
  | 'invalid-keys-format'
  | 'empty-keys-array'
  | 'incomplete-event-conflict'

export interface ConflictDetails {
  conflictingKeys: string[]
}

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E; details?: ConflictDetails }

/**
 * Parse keys input which can be either:
 * - A JSON array string: '["key1", "key2"]'
 * - A single key ID string: 'key1'
 * - An actual array: ['key1', 'key2'] (for testing)
 *
 * @param keys - Keys input in various formats
 * @returns Result with parsed key IDs or error
 */
export function parseKeysInput(
  keys: string | string[]
): Result<string[], KeyEventValidationError> {
  // If already an array, validate and return
  if (Array.isArray(keys)) {
    if (keys.length === 0) {
      return { ok: false, err: 'empty-keys-array' }
    }
    // Ensure all items are strings
    const keyIds = keys.filter((item) => typeof item === 'string')
    if (keyIds.length !== keys.length) {
      return { ok: false, err: 'invalid-keys-format' }
    }
    return { ok: true, data: keyIds }
  }

  // If string, try to parse as JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(keys)
  } catch {
    // If parsing fails, treat as single key ID
    if (typeof keys === 'string' && keys.length > 0) {
      return { ok: true, data: [keys] }
    }
    return { ok: false, err: 'invalid-keys-format' }
  }

  // Check if parsed result is an array
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { ok: false, err: 'empty-keys-array' }
    }
    // Ensure all items are strings
    const keyIds = parsed.filter((item) => typeof item === 'string')
    if (keyIds.length !== parsed.length) {
      return { ok: false, err: 'invalid-keys-format' }
    }
    return { ok: true, data: keyIds }
  }

  // Not an array, treat as invalid
  return { ok: false, err: 'invalid-keys-format' }
}

/**
 * Validate key event creation request
 *
 * Performs validation checks before creating a new key event:
 * - Parses keys input (JSON array or single key)
 * - Checks that no keys have incomplete events
 *
 * @param keys - Keys input (JSON array string or single key string)
 * @param dbConnection - Database connection or transaction
 * @returns Result with validated key IDs or error with details
 */
export async function validateKeyEventCreation(
  keys: string | string[],
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ keyIds: string[] }, KeyEventValidationError>> {
  // Step 1: Parse keys input
  const parseResult = parseKeysInput(keys)
  if (!parseResult.ok) {
    return parseResult
  }

  const keyIds = parseResult.data

  // Step 2: Check for incomplete event conflicts
  const { hasConflict, conflictingKeys } =
    await keyEventsAdapter.checkIncompleteKeyEvents(keyIds, dbConnection)

  if (hasConflict) {
    return {
      ok: false,
      err: 'incomplete-event-conflict',
      details: { conflictingKeys },
    }
  }

  return { ok: true, data: { keyIds } }
}
