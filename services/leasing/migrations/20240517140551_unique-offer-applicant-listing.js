/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('offer', (t) =>
    t.unique(['ListingId', 'ApplicantId'])
  )
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('offer', (t) =>
    t.dropUnique(['ListingId', 'ApplicantId'])
  )
}
