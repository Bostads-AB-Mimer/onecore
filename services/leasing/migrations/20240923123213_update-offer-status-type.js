/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE OFFER ADD status_new INT;
    `)
    await trx.raw(`
      UPDATE OFFER SET status_new = TRY_CAST(Status AS INT);
      ALTER TABLE OFFER DROP COLUMN Status;
      EXEC sp_rename 'OFFER.status_new', 'Status', 'COLUMN';
      ALTER TABLE OFFER ALTER COLUMN Status INT NOT NULL;
    `)
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE OFFER ADD status_old NVARCHAR(255);
    `)
    await trx.raw(`
      UPDATE OFFER SET status_old = CAST(Status AS NVARCHAR(255));
      ALTER TABLE OFFER DROP COLUMN Status;
      EXEC sp_rename 'OFFER.status_old', 'Status', 'COLUMN';
    `)
  })
}
