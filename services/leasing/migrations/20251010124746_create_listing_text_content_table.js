/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
  CREATE TABLE listing_text_content (
    id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
    rentalObjectCode nvarchar(100) NOT NULL,
    contentBlocks nvarchar(max) NOT NULL,
    createdAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE UNIQUE INDEX UQ_listing_text_content_rental_object_code
  ON listing_text_content (rentalObjectCode);
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
    DROP TABLE listing_text_content;
`)
  })
}
