/**
 * Migration for adding schema file support to key_systems table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('key_systems', (table) => {
    // MinIO file identifier for schema PDF (blob storage)
    table.string('schemaFileId').nullable()
  })
}

/**
 * Migration for removing schema file support from key_systems table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('key_systems', (table) => {
    table.dropColumn('schemaFileId')
  })
}
