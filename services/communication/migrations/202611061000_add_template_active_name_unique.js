/**
 * Unique names among active templates only (status = 1). Archiving frees the
 * name, so a new template can reuse it; the DB default collation is
 * case-insensitive, so "Nyckel" and "nyckel" collide. The template service
 * maps the violation (MSSQL error 2601) to 409 TEMPLATE_NAME_TAKEN.
 * NOTE: fails if duplicate active names already exist — archive them first.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.raw(`
    CREATE UNIQUE INDEX uq_template_active_name
      ON template(name) WHERE status = 1;
  `)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.raw(`DROP INDEX IF EXISTS uq_template_active_name ON template;`)
}
