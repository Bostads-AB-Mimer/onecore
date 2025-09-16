/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('invoice_contact', (table) => {
    table.increments('Id').primary()
    table.integer('BatchId').references('invoice_batch.Id')
    table.string('ContactCode')
    table.string('FirstName')
    table.string('LastName')
    table.string('FullName')
    table.string('NationalRegistrationNumber')
    table.string('EmailAddress')
    table.string('Street')
    table.string('StreetNumber')
    table.string('PostalCode')
    table.string('City')
    table.string('ImportStatus')
    table.datetime('ImportTime')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('invoice_contact')
}
