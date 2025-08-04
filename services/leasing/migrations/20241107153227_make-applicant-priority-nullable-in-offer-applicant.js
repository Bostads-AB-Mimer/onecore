/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('offer_applicant', function (table) {
    table.integer('applicantPriority').nullable().alter()
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('offer_applicant', function (table) {
    table.integer('applicantPriority').notNullable().alter()
  })
}
