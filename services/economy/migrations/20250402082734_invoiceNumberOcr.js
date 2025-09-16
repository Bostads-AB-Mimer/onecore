/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('invoice_data', (table) => {
    table.string('InvoiceNumber').nullable().defaultTo(null)
    table.string('OCR').nullable().defaultTo(null)
    table.string('LedgerAccount').nullable().defaultTo(null)
    table.string('TotalAccount').nullable().defaultTo(null)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('invoice_data', (table) => {
    table.dropColumn('InvoiceNumber')
    table.dropColumn('OCR')
    table.dropColumn('LedgerAccount')
    table.dropColumn('TotalAccount')
  })
}
