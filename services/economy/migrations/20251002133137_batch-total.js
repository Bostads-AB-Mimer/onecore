/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('invoice_batch', (table) => {
    table.float('BatchTotalAmount').nullable().defaultTo(null)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('invoice_batch', (table) => {
    table.dropColumn('BatchTotalAmount')
  })
}
