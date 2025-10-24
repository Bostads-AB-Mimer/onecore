/**
 * Migration to change logs table to use UTC timestamps.
 * Changes eventTime default from GETDATE() (local time) to GETUTCDATE() (UTC).
 *
 * Note: Existing logs will retain their original timestamps and may display
 * incorrect times temporarily. All new logs will be stored in UTC correctly.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // Find and drop the existing default constraint for eventTime
  await knex.raw(`
    DECLARE @ConstraintName nvarchar(200)
    SELECT @ConstraintName = Name
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('logs')
    AND parent_column_id = (
      SELECT column_id FROM sys.columns
      WHERE object_id = OBJECT_ID('logs')
      AND name = 'eventTime'
    )
    IF @ConstraintName IS NOT NULL
      EXEC('ALTER TABLE logs DROP CONSTRAINT ' + @ConstraintName)
  `)

  // Add new default constraint using GETUTCDATE() for UTC timestamps
  await knex.raw(`
    ALTER TABLE logs
    ADD CONSTRAINT DF_logs_eventTime_UTC
    DEFAULT GETUTCDATE() FOR eventTime
  `)
}

/**
 * Rollback migration - revert to using local time (GETDATE())
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  // Drop the UTC constraint
  await knex.raw(`
    ALTER TABLE logs
    DROP CONSTRAINT DF_logs_eventTime_UTC
  `)

  // Restore original constraint using GETDATE() (local time)
  await knex.raw(`
    ALTER TABLE logs
    ADD CONSTRAINT DF_logs_eventTime
    DEFAULT GETDATE() FOR eventTime
  `)
}
