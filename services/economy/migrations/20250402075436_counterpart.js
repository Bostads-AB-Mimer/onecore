/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('invoice_counterpart', (table) => {
    table.increments('Id').primary()
    table.string('CustomerName')
    table.string('CounterpartCode')
    table.string('LedgerAccount')
    table.string('TotalAccount')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('invoice_counterpart')
}
