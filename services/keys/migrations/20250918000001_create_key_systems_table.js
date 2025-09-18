/**
 * Migration for creating 'keysystem' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_systems', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('system_code').unique().notNullable()
    table.string('name').notNullable()
    table.string('manufacturer').notNullable()
    table.enum('type', ['MECHANICAL', 'ELECTRONIC', 'HYBRID']).notNullable()
    table.text('property_ids').defaultTo('[]')
    table.date('installation_date')
    table.boolean('is_active').defaultTo(true)
    table.text('description')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.string('created_by')
    table.string('updated_by')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('key_systems')
}

  /**
   * Migration for dropping 'keysystem' table.
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('key_systems');
  };