/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.raw(
    'ALTER TABLE offer ALTER COLUMN SelectionSnapshot nvarchar(max) NOT NULL;'
  )
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.raw(
    'ALTER TABLE offer ALTER COLUMN SelectionSnapshot nvarchar(255) NOT NULL;'
  )
}
