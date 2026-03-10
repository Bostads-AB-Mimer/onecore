/**
 * Business logic service for key event validation
 *
 * This service handles validation logic for creating key events:
 * 1. Validate keys array is not empty
 * 2. Check for incomplete event conflicts (keys with incomplete events)
 *
 * This extracts business logic from route handlers for better testability
 * and maintainability.
 */

import { Knex } from 'knex'
import * as keyEventsAdapter from './adapters/key-events-adapter'

export type KeyEventValidationError =
  | 'empty-keys-array'
  | 'incomplete-event-conflict'

export interface ConflictDetails {
  conflictingKeys: string[]
}

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E; details?: ConflictDetails }

/**
 * Validate keys array (already parsed by Zod schema)
 *
 * @param keys - Array of key IDs
 * @returns Result with key IDs or error
 */
export function parseKeysInput(
  keys: string[]
): Result<string[], KeyEventValidationError> {
  if (keys.length === 0) {
    return { ok: false, err: 'empty-keys-array' }
  }

  return { ok: true, data: keys }
}

/**
 * Validate key event creation request
 *
 * Performs validation checks before creating a new key event:
 * - Validates keys array is not empty
 * - Checks that no keys have incomplete events
 *
 * @param keys - Array of key IDs
 * @param dbConnection - Database connection or transaction
 * @returns Result with validated key IDs or error with details
 */
export async function validateKeyEventCreation(
  keys: string[],
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ keyIds: string[] }, KeyEventValidationError>> {
  // Step 1: Validate keys array
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
