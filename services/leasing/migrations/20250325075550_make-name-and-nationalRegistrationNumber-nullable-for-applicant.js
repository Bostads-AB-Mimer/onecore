/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('applicant', function (table) {
    table.string('NationalRegistrationNumber').defaultTo(null).alter()
  })

  return knex.schema.alterTable('applicant', function (table) {
    table.string('Name').nullable().alter()
    table.string('NationalRegistrationNumber').nullable().alter()
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Remove the index before dropping the column so that it doesn't cause an error to set it to notNullable
  await knex.schema.alterTable('applicant', function (table) {
    table.dropIndex('NationalRegistrationNumber')
  })

  await knex.schema.alterTable('applicant', function (table) {
    table.string('Name').notNullable().alter()
    table
      .string('NationalRegistrationNumber')
      .notNullable()
      .defaultTo('00000000-0000')
      .alter()
  })

  //Re-add the index
  return knex.schema.alterTable('applicant', function (table) {
    table.index('NationalRegistrationNumber')
  })
}
