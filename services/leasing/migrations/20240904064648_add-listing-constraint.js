/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .alterTable('listing', (table) => {
      table.dropUnique(['RentalObjectCode'])
    })
    .then(() =>
      knex.raw(`
        CREATE UNIQUE INDEX unique_rental_object_code_status 
        ON listing (RentalObjectCode, Status)
        WHERE Status = 1; -- ListingStatus.Active
      `)
    )
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex
    .raw(`DROP INDEX unique_rental_object_code_status ON listing;`)
    .then(() =>
      knex.schema.alterTable('listing', (table) => {
        table.unique('RentalObjectCode')
      })
    )
}
