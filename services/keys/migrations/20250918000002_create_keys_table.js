/**
 * Migration for creating 'keys' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('key_name').notNullable()
    table.string('key_sequence_number')
    table.string('flex_number')
    table.string('rental_object')
    table.enum('key_type', ['LGH', 'PB', 'FS', 'HN']).notNullable()
    table.uuid('key_system_id').references('id').inTable('key_systems')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

 /**
   * Migration for dropping 'keys' table.
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */

exports.down = function (knex) {
  return knex.schema.dropTable('keys')
}