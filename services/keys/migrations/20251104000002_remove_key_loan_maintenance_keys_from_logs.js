/**
 * Migration for removing 'keyLoanMaintenanceKeys' from logs table objectType constraint.
 * This cleans up the constraint after unifying key loan types.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Step 1: Update any existing logs with 'keyLoanMaintenanceKeys' to 'keyLoan'
  await knex('logs')
    .where('objectType', 'keyLoanMaintenanceKeys')
    .update({ objectType: 'keyLoan' })

  // Step 2: Drop existing CHECK constraint
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

  // Step 3: Add new CHECK constraint without 'keyLoanMaintenanceKeys'
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
      'receipt',
      'keyEvent',
      'signature',
      'keyNote'
    ))
  `)
}

/**
 * Migration rollback - restores 'keyLoanMaintenanceKeys' to the constraint.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Drop existing CHECK constraint
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

  // Add CHECK constraint with 'keyLoanMaintenanceKeys' restored
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
