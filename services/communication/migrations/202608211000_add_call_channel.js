/**
 * Adds the 'call' channel — phone calls to tenants logged after the fact
 * by a source system (e.g. Odoo). The work order reference travels inside
 * the dispatch body text, same as for work-order sms, so no new columns.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE dispatch DROP CONSTRAINT ck_dispatch_channel;
      ALTER TABLE dispatch ADD CONSTRAINT ck_dispatch_channel
        CHECK (channel IN ('sms','email','call'));
    `)
  })
}

/**
 * Note: fails if 'call' rows exist — they would violate the restored
 * two-value constraint, so the data must be removed first on purpose.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE dispatch DROP CONSTRAINT ck_dispatch_channel;
      ALTER TABLE dispatch ADD CONSTRAINT ck_dispatch_channel
        CHECK (channel IN ('sms','email'));
    `)
  })
}
