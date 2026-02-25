/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex('applicant')
    .whereNull('ApplicationType')
    .update({ ApplicationType: 'Additional' })

  await knex.schema.alterTable('applicant', (table) => {
    table.string('ApplicationType').notNullable().alter()
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('applicant', (table) => {
    table.string('ApplicationType').nullable().alter()
  })
}
