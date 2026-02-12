/**
 * Migration for adding 'notes' column to 'keys' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.alterTable('keys', (table) => {
    table.text('notes').nullable()
  })
}

/**
 * Migration for removing 'notes' column from 'keys' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema.alterTable('keys', (table) => {
    table.dropColumn('notes')
  })
}