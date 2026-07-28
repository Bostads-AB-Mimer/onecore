/**
 * Renames dispatch.triggeredAt -> sendAt (and its indexes). The column now
 * means "intended send time": insert time for instant sends, the target time
 * for scheduled sends (MIM-1897). sp_rename keeps existing values in place.
 * "When was this queued" is answered by createdAt + triggeredByUser.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      EXEC sp_rename 'dispatch.triggeredAt', 'sendAt', 'COLUMN';
      EXEC sp_rename
        'dispatch.idx_dispatch_triggeredAt',
        'idx_dispatch_sendAt',
        'INDEX';
      EXEC sp_rename
        'dispatch.idx_dispatch_triggeredByUser_triggeredAt',
        'idx_dispatch_triggeredByUser_sendAt',
        'INDEX';
      EXEC sp_rename
        'dispatch.idx_dispatch_messageType_triggeredAt',
        'idx_dispatch_messageType_sendAt',
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
        'dispatch.idx_dispatch_messageType_sendAt',
        'idx_dispatch_messageType_triggeredAt',
        'INDEX';
      EXEC sp_rename
        'dispatch.idx_dispatch_triggeredByUser_sendAt',
        'idx_dispatch_triggeredByUser_triggeredAt',
        'INDEX';
      EXEC sp_rename 'dispatch.idx_dispatch_sendAt', 'idx_dispatch_triggeredAt', 'INDEX';
      EXEC sp_rename 'dispatch.sendAt', 'triggeredAt', 'COLUMN';
    `)
  })
}
