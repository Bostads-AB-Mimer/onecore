/**
 * Migration to remove denormalized context fields from logs table.
 * These fields (rentalObjectCode, contactId) are being removed in favor of
 * JOIN-based queries that fetch context from source tables when needed.
 *
 * This approach:
 * - Reduces nullable fields in the schema (cleaner design)
 * - Eliminates data duplication
 * - Simplifies log creation (no context extraction needed)
 * - Trade-off: Slower queries temporarily (100-500ms) until junction tables added
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // Step 1: Drop indexes on columns we're removing
  await knex.schema.alterTable('logs', (table) => {
    table.dropIndex(['rentalObjectCode'])
    table.dropIndex(['contactId'])
  })

  // Step 2: Drop the denormalized columns
  await knex.schema.alterTable('logs', (table) => {
    table.dropColumn('rentalObjectCode')
    table.dropColumn('contactId')
  })

  // Step 3: Add composite index to support JOIN-based filtering
  // This index helps with: WHERE objectType = ? AND objectId = ?
  await knex.raw(`
    CREATE INDEX idx_logs_objectType_objectId
    ON logs(objectType, objectId)
    INCLUDE (eventTime, userName, description)
  `)
}

/**
 * Rollback: Re-add the denormalized columns and indexes
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  // Drop the composite index
  await knex.raw('DROP INDEX IF EXISTS idx_logs_objectType_objectId ON logs')

  // Re-add the columns
  await knex.schema.alterTable('logs', (table) => {
    table.string('rentalObjectCode').nullable()
    table.string('contactId').nullable()
  })

  // Re-add the indexes
  await knex.schema.alterTable('logs', (table) => {
    table.index(['rentalObjectCode'])
    table.index(['contactId'])
  })
}
