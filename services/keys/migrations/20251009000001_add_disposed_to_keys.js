/**
 * Migration for adding 'disposed' column to 'keys' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.alterTable('keys', (table) => {
    table.boolean('disposed').notNullable().defaultTo(false)
  })
}

/**
 * Migration for removing 'disposed' column from 'keys' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema.alterTable('keys', (table) => {
    table.dropColumn('disposed')
  })
}
