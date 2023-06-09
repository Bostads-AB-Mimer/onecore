/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('lease', (table) => {
    table.string('LeaseId').primary()
    table.string('LeaseNumber')
    table.date('LeaseStartDate')
    table.date('LeaseEndDate')
    table.string('NationalRegistrationNumber', 13)
    table.string('BirthDate', 10)
    table.string('Status')
    table.string('ApartmentId')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('lease')
}
