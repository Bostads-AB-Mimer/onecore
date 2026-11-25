/**
 * `template.status` is a BIT (1 active / 0 archived), not an enum like the
 * dispatch tables' status columns, so name it for what it is. The indexes that
 * reference the column are recreated on the new name.
 *
 * One statement per batch: MSSQL compiles a batch before running it, so an
 * index on `isActive` in the same batch as sp_rename fails with
 * "Invalid column name".
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP INDEX IF EXISTS uq_template_active_name ON template;`)
    await trx.raw(`DROP INDEX IF EXISTS idx_template_status ON template;`)
    await trx.raw(`EXEC sp_rename 'template.status', 'isActive', 'COLUMN';`)
    await trx.raw(`CREATE INDEX idx_template_isActive ON template(isActive);`)
    await trx.raw(`
      CREATE UNIQUE INDEX uq_template_active_name
        ON template(name) WHERE isActive = 1;
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP INDEX IF EXISTS uq_template_active_name ON template;`)
    await trx.raw(`DROP INDEX IF EXISTS idx_template_isActive ON template;`)
    await trx.raw(`EXEC sp_rename 'template.isActive', 'status', 'COLUMN';`)
    await trx.raw(`CREATE INDEX idx_template_status ON template(status);`)
    await trx.raw(`
      CREATE UNIQUE INDEX uq_template_active_name
        ON template(name) WHERE status = 1;
    `)
  })
}
