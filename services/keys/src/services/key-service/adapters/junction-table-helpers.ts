import { Knex } from 'knex'

/**
 * Helper functions for managing junction tables.
 * These functions ensure consistency between JSON arrays and junction tables
 * during the transition period.
 */

/**
 * Sync key_loan_items junction table with key_loans.keys JSON array
 * This should be called after creating or updating a key_loan
 * Automatically deduplicates key IDs to handle data quality issues
 *
 * @param keyLoanId - The key loan ID
 * @param keyIds - Array of key IDs (can be from JSON.parse(keyLoan.keys))
 * @param dbConnection - Database connection or transaction
 */
export async function syncKeyLoanItems(
  keyLoanId: string,
  keyIds: string[],
  dbConnection: Knex | Knex.Transaction
): Promise<void> {
  // Delete existing items for this loan
  await dbConnection('key_loan_items').where({ keyLoanId }).del()

  // Remove duplicates using Set (handles data quality issues)
  const uniqueKeyIds = [...new Set(keyIds)]

  // Insert new items if any keys exist
  if (uniqueKeyIds.length > 0) {
    const items = uniqueKeyIds.map((keyId) => ({
      id: dbConnection.raw('NEWID()'),
      keyLoanId,
      keyId,
      createdAt: dbConnection.fn.now(),
    }))

    await dbConnection('key_loan_items').insert(items)
  }
}

/**
 * Sync key_event_items junction table with key_events.keys JSON array
 * This should be called after creating or updating a key_event
 * Automatically deduplicates key IDs to handle data quality issues
 *
 * @param keyEventId - The key event ID
 * @param keyIds - Array of key IDs (can be from JSON.parse(keyEvent.keys))
 * @param dbConnection - Database connection or transaction
 */
export async function syncKeyEventItems(
  keyEventId: string,
  keyIds: string[],
  dbConnection: Knex | Knex.Transaction
): Promise<void> {
  // Delete existing items for this event
  await dbConnection('key_event_items').where({ keyEventId }).del()

  // Remove duplicates using Set (handles data quality issues)
  const uniqueKeyIds = [...new Set(keyIds)]

  // Insert new items if any keys exist
  if (uniqueKeyIds.length > 0) {
    const items = uniqueKeyIds.map((keyId) => ({
      id: dbConnection.raw('NEWID()'),
      keyEventId,
      keyId,
      createdAt: dbConnection.fn.now(),
    }))

    await dbConnection('key_event_items').insert(items)
  }
}

/**
 * Parse keys from JSON string and sync to junction table for key loans
 * Convenience function that combines JSON parsing and syncing
 *
 * @param keyLoanId - The key loan ID
 * @param keysJson - JSON string of key IDs (e.g., '["id1", "id2"]')
 * @param dbConnection - Database connection or transaction
 */
export async function parseAndSyncKeyLoanItems(
  keyLoanId: string,
  keysJson: string,
  dbConnection: Knex | Knex.Transaction
): Promise<void> {
  try {
    const keyIds = JSON.parse(keysJson || '[]')
    await syncKeyLoanItems(keyLoanId, keyIds, dbConnection)
  } catch (error) {
    console.error(`Error parsing keys JSON for loan ${keyLoanId}:`, error)
    // Proceed without throwing - maintains backwards compatibility
  }
}

/**
 * Parse keys from JSON string and sync to junction table for key events
 * Convenience function that combines JSON parsing and syncing
 *
 * @param keyEventId - The key event ID
 * @param keysJson - JSON string of key IDs (e.g., '["id1", "id2"]')
 * @param dbConnection - Database connection or transaction
 */
export async function parseAndSyncKeyEventItems(
  keyEventId: string,
  keysJson: string,
  dbConnection: Knex | Knex.Transaction
): Promise<void> {
  try {
    const keyIds = JSON.parse(keysJson || '[]')
    await syncKeyEventItems(keyEventId, keyIds, dbConnection)
  } catch (error) {
    console.error(`Error parsing keys JSON for event ${keyEventId}:`, error)
    // Proceed without throwing - maintains backwards compatibility
  }
}
