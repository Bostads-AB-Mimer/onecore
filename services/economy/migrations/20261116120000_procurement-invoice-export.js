/**
 * Records every procurement invoice (Mälarenergi) that has been exported to
 * Xledger, so that the same invoice is never exported twice and voucher
 * numbers can continue from the last one used on the same day.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('procurement_invoice_export', (table) => {
    table.increments('Id').primary()
    table.string('InvoiceNumber', 50).notNullable().unique()
    table.string('VoucherNo', 20).notNullable().index()
    table.decimal('Amount', 18, 2)
    table.string('ExportedFilename', 255).notNullable()
    table.datetime('ExportedDate').notNullable().defaultTo(knex.fn.now())
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('procurement_invoice_export')
}
