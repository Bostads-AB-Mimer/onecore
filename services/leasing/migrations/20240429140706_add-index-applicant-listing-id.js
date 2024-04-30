/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  knex.schema.table('applicant', (t) => t.index('ListingId', 'idx_listingId'))
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  knex.schema.table('applicant', (t) =>
    t.dropIndex('ListingId', 'idx_listingId')
  )
}
