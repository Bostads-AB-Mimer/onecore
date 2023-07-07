/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('contact', (table) => {
    table.string('ContactId')
    table.string('LeaseId')
    table.string('FirstName')
    table.string('LastName')
    table.string('FullName')
    table.string('Type')
    table.string('NationalRegistrationNumber', 13)
    table.date('BirthDate')
    table.string('Street')
    table.string('StreetNumber')
    table.string('PostalCode')
    table.string('City')
    table.string('Country')
    table.string('MobilePhone')
    table.string('PhoneNumber')
    table.string('EmailAddress')
    table.dateTime('LastUpdated')
    table.primary(['ContactId', 'LeaseId'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('contact')
}
