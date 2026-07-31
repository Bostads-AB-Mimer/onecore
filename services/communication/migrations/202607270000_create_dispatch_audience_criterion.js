/**
 * Dispatch-centre (MIM-1911): normalized audience-filter storage so dispatches
 * become filterable by the audience they targeted, plus a (dispatchId, status)
 * index for the derived-status rollup/filter.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE dispatch_audience_criterion (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        dispatchId UNIQUEIDENTIFIER NOT NULL,
        type VARCHAR(40) NOT NULL,
        value NVARCHAR(200) NOT NULL,
        CONSTRAINT fk_dac_dispatch
          FOREIGN KEY (dispatchId) REFERENCES dispatch(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_dac_type_value
        ON dispatch_audience_criterion(type, value) INCLUDE (dispatchId);

      CREATE INDEX idx_message_recipient_dispatchId_status
        ON message_recipient(dispatchId, status);
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
      DROP INDEX IF EXISTS idx_message_recipient_dispatchId_status ON message_recipient;
      DROP TABLE IF EXISTS dispatch_audience_criterion;
    `)
  })
}
