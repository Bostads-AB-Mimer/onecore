/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
  CREATE TABLE listing_text_content (
    Id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
    RentalObjectCode nvarchar(100) NOT NULL,
    ContentBlocks nvarchar(max) NOT NULL,
    CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE UNIQUE INDEX UQ_listing_text_content_rental_object_code
  ON listing_text_content (RentalObjectCode);
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
