/**
 * Adds 'scheduled' and 'cancelled' to the allowed message_recipient statuses
 * (MIM-1897). 'scheduled' marks recipients of a dispatch queued at Infobip for
 * future delivery; 'cancelled' is set when such a dispatch is withdrawn before
 * it fires. MSSQL cannot alter a CHECK constraint, so drop + recreate.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE message_recipient
        DROP CONSTRAINT ck_message_recipient_status;
      ALTER TABLE message_recipient
        ADD CONSTRAINT ck_message_recipient_status
        CHECK (status IN (
          'pending','sent','delivered','failed','bounced','received',
          'scheduled','cancelled'
        ));
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE message_recipient
        DROP CONSTRAINT ck_message_recipient_status;
      ALTER TABLE message_recipient
        ADD CONSTRAINT ck_message_recipient_status
        CHECK (status IN (
          'pending','sent','delivered','failed','bounced','received'
        ));
    `)
  })
}
