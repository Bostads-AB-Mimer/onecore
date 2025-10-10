/**
 * Migration for removing 'lease' column from 'key_loans' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.alterTable('key_loans', (table) => {
    table.dropColumn('lease')
  })
}

/**
 * Migration for rolling back - adding 'lease' column to 'key_loans' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema.alterTable('key_loans', (table) => {
    table.string('lease')
  })
}
