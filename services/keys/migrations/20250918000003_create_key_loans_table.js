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
    table.string('contact2')
    table.string('lease')
    table.timestamp('returnedAt')
    table.timestamp('availableToNextTenantFrom')
    table.timestamp('pickedUpAt')
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())
    table.string('createdBy')
    table.string('updatedBy')
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