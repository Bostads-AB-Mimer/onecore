/**
 * Scheduled sends move from Infobip to our own worker (MIM-1838). Recipient
 * rows now carry the claim state: `claimedUntil` fences a worker's claim,
 * `attempts` counts claims (and doubles as a fencing token for status writes).
 * New status 'sending' = claimed, provider call in flight. The filtered index
 * backs the worker's claim/expiry scans over the small set of open rows.
 * MSSQL cannot alter a CHECK constraint, so drop + recreate.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE message_recipient
        ADD claimedUntil DATETIME2 NULL,
            attempts INT NOT NULL CONSTRAINT df_message_recipient_attempts DEFAULT 0;
      ALTER TABLE message_recipient
        DROP CONSTRAINT ck_message_recipient_status;
      ALTER TABLE message_recipient
        ADD CONSTRAINT ck_message_recipient_status
        CHECK (status IN (
          'pending','sent','delivered','failed','bounced','received',
          'scheduled','sending','cancelled'
        ));
      CREATE INDEX idx_message_recipient_open_scheduled
        ON message_recipient(dispatchId) INCLUDE (status, claimedUntil)
        WHERE status IN ('scheduled','sending');
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
      DROP INDEX idx_message_recipient_open_scheduled ON message_recipient;
      ALTER TABLE message_recipient
        DROP CONSTRAINT ck_message_recipient_status;
      ALTER TABLE message_recipient
        ADD CONSTRAINT ck_message_recipient_status
        CHECK (status IN (
          'pending','sent','delivered','failed','bounced','received',
          'scheduled','cancelled'
        ));
      ALTER TABLE message_recipient
        DROP CONSTRAINT df_message_recipient_attempts;
      ALTER TABLE message_recipient
        DROP COLUMN claimedUntil, attempts;
    `)
  })
}
