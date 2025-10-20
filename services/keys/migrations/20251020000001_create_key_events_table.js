/**
 * Migration for creating 'key_events' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('keys').notNullable()
    table.enum('type', ['FLEX', 'ORDER', 'LOST']).notNullable()
    table.enum('status', ['ORDERED', 'RECEIVED', 'COMPLETED']).notNullable()
    table.uuid('workOrderId').nullable()
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())
  })
}

/**
 * Migration for dropping 'key_events' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema.dropTable('key_events')
}
