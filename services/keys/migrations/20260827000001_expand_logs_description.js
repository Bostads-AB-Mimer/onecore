/**
 * Expand logs.description to nvarchar(max) so bulk ops can log their full affected-id list.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // The composite index INCLUDEs description, so drop/recreate around the alter
  await knex.raw('DROP INDEX IF EXISTS idx_logs_objectType_objectId ON logs')
  await knex.schema.alterTable('logs', (table) => {
    table.text('description').alter()
  })
  await knex.raw(`
    CREATE INDEX idx_logs_objectType_objectId
    ON logs(objectType, objectId)
    INCLUDE (eventTime, userName, description)
  `)
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_logs_objectType_objectId ON logs')
  // Lossy by necessity: rows longer than the old cap must be truncated to shrink the column
  await knex.raw(
    'UPDATE logs SET description = LEFT(description, 1000) WHERE LEN(description) > 1000'
  )
  await knex.schema.alterTable('logs', (table) => {
    table.string('description', 1000).alter()
  })
  await knex.raw(`
    CREATE INDEX idx_logs_objectType_objectId
    ON logs(objectType, objectId)
    INCLUDE (eventTime, userName, description)
  `)
}
