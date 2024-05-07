/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('applicant', function (table) {
    table
      .string('NationalRegistrationNumber')
      .notNullable()
      .defaultTo('00000000-0000')
    table.index('NationalRegistrationNumber')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('applicant', function (table) {
    table.dropIndex('NationalRegistrationNumber')
    table.dropColumn('NationalRegistrationNumber')
  })
}
