/**
 * Migration for creating 'keys' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('keyName').notNullable()
    table.integer('keySequenceNumber')
    table.integer('flexNumber')
    table.string('rentalObjectCode')
    table.enum('keyType', ['LGH', 'PB', 'FS', 'HN']).notNullable()
    table.uuid('keySystemId').references('id').inTable('key_systems')
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())
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