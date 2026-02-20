/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('key_loan_maintenance_keys', (table) => {
    table.timestamp('pickedUpAt').nullable()
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('key_loan_maintenance_keys', (table) => {
    table.dropColumn('pickedUpAt')
    table.dropColumn('createdAt')
  })
}
