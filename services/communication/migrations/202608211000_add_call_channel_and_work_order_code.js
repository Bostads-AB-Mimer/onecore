/**
 * Adds the 'call' channel (phone calls logged from Odoo errands) and a
 * workOrderCode column on dispatch holding the Odoo errand code ("od-<id>"),
 * which the frontend uses to link the log entry to the errand in Odoo.
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
      ALTER TABLE dispatch ADD workOrderCode NVARCHAR(50) NULL;
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
      ALTER TABLE dispatch DROP COLUMN workOrderCode;
      ALTER TABLE dispatch DROP CONSTRAINT ck_dispatch_channel;
      ALTER TABLE dispatch ADD CONSTRAINT ck_dispatch_channel
        CHECK (channel IN ('sms','email'));
    `)
  })
}
