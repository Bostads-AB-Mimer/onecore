/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('invoice_base', (table) => {
      table.increments('Id').primary()
      table.string('ExternalIdentifier').notNullable().unique().index()
      table.string('ContactCode').notNullable().index()
      table.string('LeaseId').notNullable()
      table.datetime('CreatedAt').notNullable().defaultTo(knex.fn.now())
    })
    .createTable('invoice_base_item', (table) => {
      table.integer('InvoiceBaseId').references('Id').inTable('invoice_base')
      table.string('XledgerDbId').notNullable()
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('invoice_base_item')
    .dropTableIfExists('invoice_base')
}
