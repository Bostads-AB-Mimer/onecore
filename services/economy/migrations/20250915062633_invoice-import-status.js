/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('invoice_import_status', (table) => {
    table.increments('Id').primary()
    table.string('InvoiceNumber')
    table.string('InvoiceType')
    table.datetime('ImportedDate')
    table.string('Amount')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('invoice_import_status')
}
