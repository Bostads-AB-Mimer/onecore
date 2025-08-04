/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex
    .raw(`DROP INDEX unique_rental_object_code_status ON listing;`)
    .then(() =>
      knex.raw(`
        CREATE UNIQUE INDEX unique_rental_object_code_status 
        ON listing (RentalObjectCode)WHERE Status <> 3; -- i.e NOT ListingStatus.Closed
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
      knex.raw(`
        CREATE UNIQUE INDEX unique_rental_object_code_status 
        ON listing (RentalObjectCode)
        WHERE Status = 1; -- ListingStatus.Active
      `)
    )
}
