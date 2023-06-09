/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('person', (table) => {
    table.string('PersonId').primary()
    table.string('FirstName')
    table.string('LastName')
    table.string('NationalRegistrationNumber', 13)
    table.string('BirthDate', 10)
    table.string('Street')
    table.string('StreetNumber')
    table.string('PostalCode')
    table.string('City')
    table.string('Country')
    table.string('MobilePhone')
    table.string('PhoneNumber')
    table.string('EmailAddress')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('person')
}