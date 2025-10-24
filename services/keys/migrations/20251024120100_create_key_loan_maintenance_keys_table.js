/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('key_loan_maintenance_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.text('keys').defaultTo('[]')
    table.string('company')
    table.string('contactPerson')
    table.timestamp('returnedAt')
    table.text('description')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('key_loan_maintenance_keys')
}
