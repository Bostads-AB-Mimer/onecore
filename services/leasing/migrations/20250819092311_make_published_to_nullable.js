/**
 * Migration to make PublishedTo column nullable to support NON_SCORED listings
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('listing', (table) => {
    table.dateTime('PublishedTo').nullable().alter()
  })
}

/**
 * Migration rollback - make PublishedTo not nullable again
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('listing', (table) => {
    table.dateTime('PublishedTo').notNullable().alter()
  })
}
