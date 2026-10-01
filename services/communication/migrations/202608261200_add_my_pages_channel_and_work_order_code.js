/**
 * MIM-1957: adds the 'my-pages' channel (a publication to the tenant portal
 * rather than a provider send) and a nullable workOrderCode so communication
 * log rows can link to their Odoo errand.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    // Each statement is its own raw() call: MSSQL compiles a whole batch before
    // executing it, so a CREATE INDEX referencing a column added earlier in the
    // same batch fails with "Invalid column name".
    await trx.raw(`ALTER TABLE dispatch DROP CONSTRAINT ck_dispatch_channel;`)
    await trx.raw(`
      ALTER TABLE dispatch ADD CONSTRAINT ck_dispatch_channel
        CHECK (channel IN ('sms','email','my-pages'));
    `)
    await trx.raw(`ALTER TABLE dispatch ADD workOrderCode NVARCHAR(50) NULL;`)
    await trx.raw(`
      CREATE INDEX idx_dispatch_workOrderCode ON dispatch(workOrderCode);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP INDEX idx_dispatch_workOrderCode ON dispatch;`)
    await trx.raw(`ALTER TABLE dispatch DROP COLUMN workOrderCode;`)
    await trx.raw(`ALTER TABLE dispatch DROP CONSTRAINT ck_dispatch_channel;`)
    // Rolling back with 'my-pages' rows present would violate the narrowed
    // constraint, so drop those rows' recipients first via ON DELETE CASCADE.
    await trx.raw(`DELETE FROM dispatch WHERE channel = 'my-pages';`)
    await trx.raw(`
      ALTER TABLE dispatch ADD CONSTRAINT ck_dispatch_channel
        CHECK (channel IN ('sms','email'));
    `)
  })
}
