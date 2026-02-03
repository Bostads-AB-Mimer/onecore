/**
 * Migration for adding keyCards field to key_loans table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('key_loans', (table) => {
    table.text('keyCards').nullable().defaultTo('[]')
  })
}

/**
 * Migration for removing keyCards field from key_loans table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('key_loans', (table) => {
    table.dropColumn('keyCards')
  })
}
