/**
 * Migration to remove default value from updatedAt in receipts table
 * and set existing records to null where updatedAt = createdAt
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // First, update existing records where updatedAt equals createdAt to set updatedAt to null
  await knex.raw(`
    UPDATE receipts
    SET updatedAt = NULL
    WHERE updatedAt = createdAt
  `)

  // Then alter the column to remove the default
  await knex.schema.alterTable('receipts', (table) => {
    table.timestamp('updatedAt').nullable().defaultTo(null).alter()
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  // Restore the default value
  await knex.schema.alterTable('receipts', (table) => {
    table.timestamp('updatedAt').defaultTo(knex.fn.now()).alter()
  })
}
