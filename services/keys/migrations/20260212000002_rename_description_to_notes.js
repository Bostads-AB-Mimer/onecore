/**
 * Migration for renaming 'description' column to 'notes' in key_systems and key_loans tables.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function (knex) {
  const hasDescriptionInKeySystems = await knex.schema.hasColumn(
    'key_systems',
    'description'
  )
  if (hasDescriptionInKeySystems) {
    await knex.schema.alterTable('key_systems', (table) => {
      table.renameColumn('description', 'notes')
    })
  }

  const hasDescriptionInKeyLoans = await knex.schema.hasColumn(
    'key_loans',
    'description'
  )
  if (hasDescriptionInKeyLoans) {
    await knex.schema.alterTable('key_loans', (table) => {
      table.renameColumn('description', 'notes')
    })
  }
}

/**
 * Migration for reverting 'notes' column back to 'description'.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = async function (knex) {
  const hasNotesInKeySystems = await knex.schema.hasColumn(
    'key_systems',
    'notes'
  )
  if (hasNotesInKeySystems) {
    await knex.schema.alterTable('key_systems', (table) => {
      table.renameColumn('notes', 'description')
    })
  }

  const hasNotesInKeyLoans = await knex.schema.hasColumn('key_loans', 'notes')
  if (hasNotesInKeyLoans) {
    await knex.schema.alterTable('key_loans', (table) => {
      table.renameColumn('notes', 'description')
    })
  }
}
