/**
 * Migration for creating 'keysystem' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_systems', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.string('systemCode').unique().notNullable()
    table.string('name').notNullable()
    table.string('manufacturer').notNullable()
    table.string('managingSupplier')
    table.enum('type', ['MECHANICAL', 'ELECTRONIC', 'HYBRID']).notNullable()
    table.text('propertyIds').defaultTo('[]')
    table.date('installationDate')
    table.boolean('isActive').defaultTo(true)
    table.text('description')
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())
    table.string('createdBy')
    table.string('updatedBy')
  })
}

/**
 * Migration for dropping 'key_systems' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('key_systems')
}