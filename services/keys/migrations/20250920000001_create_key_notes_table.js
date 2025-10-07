/**
 * Migration for creating 'key_notes' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('rentalObjectCode').notNullable()
    table.text('description').notNullable()

    // Create index on rentalObjectCode for faster lookups
    table.index('rentalObjectCode')
  })
}

 /**
   * Migration for dropping 'key_notes' table.
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */

exports.down = function (knex) {
  return knex.schema.dropTable('key_notes')
}
