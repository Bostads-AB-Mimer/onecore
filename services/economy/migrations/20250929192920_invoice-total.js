/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('invoice_data', (table) => {
    table.decimal('InvoiceTotalAmount').nullable().defaultTo(null)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('invoice_data', (table) => {
    table.dropColumn('InvoiceTotalAmount')
  })
}
