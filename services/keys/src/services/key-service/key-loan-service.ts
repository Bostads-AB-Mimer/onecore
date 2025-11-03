/**
 * Business logic service for key loan validation
 *
 * This service handles validation logic for creating and updating key loans:
 * 1. Parse and validate keys JSON array format
 * 2. Check for active loan conflicts (keys already loaned out)
 * 3. Ensure keys array is not empty
 *
 * This extracts business logic from route handlers for better testability
 * and maintainability.
 */

import { Knex } from 'knex'
import * as keyLoansAdapter from './adapters/key-loans-adapter'

export type KeyLoanValidationError =
  | 'invalid-keys-format'
  | 'empty-keys-array'
  | 'keys-not-array'
  | 'active-loan-conflict'

export interface ConflictDetails {
  conflictingKeys: string[]
}

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E; details?: ConflictDetails }

/**
 * Parse keys from JSON string into array
 *
 * @param keys - JSON string representing array of key IDs
 * @returns Result with parsed key IDs or error
 */
export function parseKeysArray(
  keys: string
): Result<string[], KeyLoanValidationError> {
  // Try to parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(keys)
  } catch {
    return { ok: false, err: 'invalid-keys-format' }
  }

  // Check if it's an array
  if (!Array.isArray(parsed)) {
    return { ok: false, err: 'keys-not-array' }
  }

  // Check if array is empty
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

/**
 * Validate key loan creation request
 *
 * Performs validation checks before creating a new key loan:
 * - Parses keys JSON array
 * - Checks that no keys have active loans
 *
 * @param keys - JSON string of key IDs
 * @param dbConnection - Database connection or transaction
 * @returns Result with validated key IDs or error with details
 */
export async function validateKeyLoanCreation(
  keys: string,
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ keyIds: string[] }, KeyLoanValidationError>> {
  // Step 1: Parse keys array
  const parseResult = parseKeysArray(keys)
  if (!parseResult.ok) {
    return parseResult
  }

  const keyIds = parseResult.data

  // Step 2: Check for active loan conflicts
  const { hasConflict, conflictingKeys } =
    await keyLoansAdapter.checkActiveKeyLoans(keyIds, undefined, dbConnection)

  if (hasConflict) {
    return {
      ok: false,
      err: 'active-loan-conflict',
      details: { conflictingKeys },
    }
  }

  return { ok: true, data: { keyIds } }
}

/**
 * Validate key loan update request
 *
 * Performs validation checks before updating an existing key loan:
 * - Parses keys JSON array
 * - Checks that no keys have active loans (excluding current loan)
 *
 * @param loanId - ID of the loan being updated
 * @param keys - JSON string of key IDs
 * @param dbConnection - Database connection or transaction
 * @returns Result with validated key IDs or error with details
 */
export async function validateKeyLoanUpdate(
  loanId: string,
  keys: string,
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ keyIds: string[] }, KeyLoanValidationError>> {
  // Step 1: Parse keys array
  const parseResult = parseKeysArray(keys)
  if (!parseResult.ok) {
    return parseResult
  }

  const keyIds = parseResult.data

  // Step 2: Check for active loan conflicts (excluding current loan)
  const { hasConflict, conflictingKeys } =
    await keyLoansAdapter.checkActiveKeyLoans(keyIds, loanId, dbConnection)

  if (hasConflict) {
    return {
      ok: false,
      err: 'active-loan-conflict',
      details: { conflictingKeys },
    }
  }

  return { ok: true, data: { keyIds } }
}
