/**
 * Business logic service for key loan validation
 *
 * This service handles validation logic for creating and updating key loans:
 * 1. Validate keys array is not empty
 * 2. Check for active loan conflicts (keys already loaned out)
 *
 * This extracts business logic from route handlers for better testability
 * and maintainability.
 */

import { Knex } from 'knex'
import * as keyLoansAdapter from './adapters/key-loans-adapter'

export type KeyLoanValidationError = 'empty-keys-array' | 'active-loan-conflict'

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
 * @returns Result with validated key IDs or error
 */
export function parseKeysArray(
  keys: string[]
): Result<string[], KeyLoanValidationError> {
  if (keys.length === 0) {
    return { ok: false, err: 'empty-keys-array' }
  }

  return { ok: true, data: keys }
}

/**
 * Validate key loan creation request
 *
 * Performs validation checks before creating a new key loan:
 * - Validates keys array is not empty
 * - Checks that no keys have active loans
 *
 * @param keys - Array of key IDs
 * @param dbConnection - Database connection or transaction
 * @returns Result with validated key IDs or error with details
 */
export async function validateKeyLoanCreation(
  keys: string[],
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ keyIds: string[] }, KeyLoanValidationError>> {
  // Step 1: Validate keys array
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
 * - Validates keys array is not empty
 * - Checks that no keys have active loans (excluding current loan)
 *
 * @param loanId - ID of the loan being updated
 * @param keys - Array of key IDs
 * @param dbConnection - Database connection or transaction
 * @returns Result with validated key IDs or error with details
 */
export async function validateKeyLoanUpdate(
  loanId: string,
  keys: string[],
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ keyIds: string[] }, KeyLoanValidationError>> {
  // Step 1: Validate keys array
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
