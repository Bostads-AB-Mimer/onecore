/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('key_bundles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('name').notNullable()
    table.text('keys').defaultTo('[]')
    table.text('description')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('key_bundles')
}
