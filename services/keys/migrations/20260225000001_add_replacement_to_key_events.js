/**
 * Migration to add 'REPLACEMENT' to the key_events type enum.
 *
 * MSSQL uses CHECK constraints for Knex enum columns.
 * We drop the existing constraint and re-create it with the new value.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Drop existing CHECK constraint on 'type' column
  await knex.raw(`
    DECLARE @constraintName NVARCHAR(200)
    SELECT @constraintName = name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('key_events')
      AND definition LIKE '%type%'
    IF @constraintName IS NOT NULL
      EXEC('ALTER TABLE key_events DROP CONSTRAINT ' + @constraintName)
  `)

  // Re-create with REPLACEMENT added
  await knex.raw(`
    ALTER TABLE key_events
    ADD CONSTRAINT CK_key_events_type
    CHECK (type IN ('FLEX', 'ORDER', 'LOST', 'REPLACEMENT'))
  `)
}

/**
 * Rollback: restore original CHECK constraint without REPLACEMENT.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE key_events DROP CONSTRAINT CK_key_events_type
  `)

  await knex.raw(`
    DECLARE @constraintName NVARCHAR(200)
    SELECT @constraintName = name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('key_events')
      AND definition LIKE '%type%'
    IF @constraintName IS NOT NULL
      EXEC('ALTER TABLE key_events DROP CONSTRAINT ' + @constraintName)
  `)

  await knex.raw(`
    ALTER TABLE key_events
    ADD CONSTRAINT CK_key_events_type
    CHECK (type IN ('FLEX', 'ORDER', 'LOST'))
  `)
}
