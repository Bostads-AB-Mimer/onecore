/**
 * Migration for creating 'key_loans' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_loans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.text('keys').defaultTo('[]')
    table.string('contact')
    table.string('lease')
    table.timestamp('returned_at')
    table.timestamp('available_to_next_tenant_from')
    table.timestamp('picked_up_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.string('created_by')
    table.string('updated_by')
  })
}

 /**
   * Migration for dropping 'key_loans' table.
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */

exports.down = function (knex) {
  return knex.schema.dropTable('key_loans')
}