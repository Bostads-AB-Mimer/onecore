/**
 * Migration for adding context fields to 'logs' table and expanding objectType enum.
 * Adds rentalObjectCode, contactId for better log filtering.
 * Expands objectType enum to include new types without modifying existing data.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // Step 1: Add new context fields with indexes
  await knex.schema.alterTable('logs', (table) => {
    // Add rental object code for property-based filtering
    table.string('rentalObjectCode').nullable()

    // Add contact ID for person-based filtering
    table.uuid('contactId').nullable()

    // Add indexes for new fields to improve query performance
    table.index(['rentalObjectCode'])
    table.index(['contactId'])
  })

  // Step 2: Drop existing CHECK constraint on objectType
  await knex.raw(`
    DECLARE @ConstraintName nvarchar(200)
    SELECT @ConstraintName = Name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('logs')
    AND parent_column_id = (
      SELECT column_id FROM sys.columns
      WHERE object_id = OBJECT_ID('logs')
      AND name = 'objectType'
    )
    IF @ConstraintName IS NOT NULL
      EXEC('ALTER TABLE logs DROP CONSTRAINT ' + @ConstraintName)
  `)

  // Step 3: Add new CHECK constraint with expanded enum values
  // Includes both snake_case (old) and camelCase (new) for compatibility
  await knex.raw(`
    ALTER TABLE logs
    ADD CONSTRAINT CHK_logs_objectType
    CHECK (objectType IN (
      'key',
      'keySystem',
      'keyLoan',
      'key_system',
      'key_loan',
      'keyBundle',
      'keyLoanMaintenanceKeys',
      'receipt',
      'keyEvent',
      'signature',
      'keyNote'
    ))
  `)
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  // Remove indexes and new columns
  await knex.schema.alterTable('logs', (table) => {
    table.dropIndex(['rentalObjectCode'])
    table.dropIndex(['contactId'])
    table.dropColumn('rentalObjectCode')
    table.dropColumn('contactId')
  })

  // Revert CHECK constraint to original values
  await knex.raw(`
    DECLARE @ConstraintName nvarchar(200)
    SELECT @ConstraintName = Name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('logs')
    AND parent_column_id = (
      SELECT column_id FROM sys.columns
      WHERE object_id = OBJECT_ID('logs')
      AND name = 'objectType'
    )
    IF @ConstraintName IS NOT NULL
      EXEC('ALTER TABLE logs DROP CONSTRAINT ' + @ConstraintName)
  `)

  await knex.raw(`
    ALTER TABLE logs
    ADD CONSTRAINT CHK_logs_objectType
    CHECK (objectType IN ('key_system', 'key', 'key_loan'))
  `)
}
