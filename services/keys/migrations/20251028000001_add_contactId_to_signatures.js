/**
 * Migration to replace recipientEmail/recipientName with contactId
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('signatures', (table) => {
    // Add contactId column (nullable for custom recipients)
    table.string('contactId').nullable()

    // Drop old columns
    table.dropColumn('recipientEmail')
    table.dropColumn('recipientName')

    // Add index on contactId for lookups
    table.index(['contactId'])
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('signatures', (table) => {
    // Restore old columns
    table.string('recipientEmail').notNullable()
    table.string('recipientName').nullable()

    // Remove contactId
    table.dropColumn('contactId')
  })
}
