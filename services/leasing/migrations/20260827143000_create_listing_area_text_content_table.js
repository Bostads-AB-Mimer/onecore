/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
  CREATE TABLE listing_area_text_content (
    Id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
    MarketAreaCode nvarchar(20) NOT NULL,
    ContentBlocks nvarchar(max) NOT NULL,
    CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE UNIQUE INDEX UQ_listing_area_text_content_market_area_code
  ON listing_area_text_content (MarketAreaCode);
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
    DROP TABLE listing_area_text_content;
`)
  })
}
