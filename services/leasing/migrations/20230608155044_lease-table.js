/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('lease', (table) => {
    table.string('LeaseId').primary()
    table.string('RentalPropertyId')
    table.string('LeaseNumber')
    table.date('LeaseStartDate')
    table.date('LeaseEndDate')
    table.string('Status')
    table.string('Type')
    table.dateTime('LastUpdated')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lease')
}
