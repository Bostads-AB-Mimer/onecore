/**
 * Migration for creating 'offer' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('offer', (table) => {
    table.increments('Id').primary().notNullable()
    table.dateTime('SentAt')
    table.dateTime('ExpiresAt').notNullable()
    table.dateTime('AnsweredAt')
    table.string('SelectionSnapshot').notNullable() // JSON
    table.string('Status').notNullable()
    table.foreign('ListingId').references('Listing.Id').notNullable()
    table.foreign('ApplicantId').references('Applicant.Id').notNullable()
  })
}

/**
 * Migration for dropping 'applicant' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('offer')
}
