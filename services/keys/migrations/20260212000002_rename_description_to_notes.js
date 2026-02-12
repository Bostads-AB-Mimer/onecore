/**
 * Migration for renaming 'description' column to 'notes' in key_systems and key_loans tables.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema
    .alterTable('key_systems', (table) => {
      table.renameColumn('description', 'notes')
    })
    .then(() =>
      knex.schema.alterTable('key_loans', (table) => {
        table.renameColumn('description', 'notes')
      })
    )
}

/**
 * Migration for reverting 'notes' column back to 'description'.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema
    .alterTable('key_systems', (table) => {
      table.renameColumn('notes', 'description')
    })
    .then(() =>
      knex.schema.alterTable('key_loans', (table) => {
        table.renameColumn('notes', 'description')
      })
    )
}
