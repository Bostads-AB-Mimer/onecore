/**
 * Renames message_recipient.kundId -> contactCode (and its index) to align
 * with the English naming convention used across the codebase. The column
 * holds the tenant's contactCode, so the new name is also more accurate.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      EXEC sp_rename 'message_recipient.kundId', 'contactCode', 'COLUMN';
      EXEC sp_rename
        'message_recipient.idx_message_recipient_kundId_dispatchId',
        'idx_message_recipient_contactCode_dispatchId',
        'INDEX';
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
      EXEC sp_rename
        'message_recipient.idx_message_recipient_contactCode_dispatchId',
        'idx_message_recipient_kundId_dispatchId',
        'INDEX';
      EXEC sp_rename 'message_recipient.contactCode', 'kundId', 'COLUMN';
    `)
  })
}
