/**
 * Migration to add index on keys.rentalObjectCode for efficient filtering.
 * This index is critical for JOIN-based log filtering by rental object code.
 *
 * Without this index, queries like:
 *   SELECT logs.* FROM logs
 *   INNER JOIN keys ON logs.objectId = keys.id
 *   WHERE keys.rentalObjectCode = ?
 * would require a table scan on the keys table.
 *
 * With this index, the query uses an index seek (O(log n) instead of O(n)).
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE INDEX idx_keys_rentalObjectCode
    ON keys(rentalObjectCode)
  `)
}

/**
 * Rollback: Drop the index
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_keys_rentalObjectCode ON keys')
}
