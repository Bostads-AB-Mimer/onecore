/**
 * Migration to remove 'signed' column from receipts table
 * Logic: fileId presence indicates signed status (fileId !== null = signed)
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('receipts', (table) => {
    table.dropColumn('signed')
  })
}

/**
 * Rollback: Restore signed column with values based on fileId
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('receipts', (table) => {
    table.boolean('signed').notNullable().defaultTo(false)
  })

  // Restore signed status based on fileId presence
  await knex('receipts')
    .update({ signed: true })
    .whereNotNull('fileId')
}
