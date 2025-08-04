/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.raw(`
    CREATE TABLE application_profile (
      id int NOT NULL PRIMARY KEY IDENTITY,
      contactCode nvarchar(36) NOT NULL,
      numAdults int NOT NULL,
      numChildren int NOT NULL,
      expiresAt datetimeoffset,
      createdAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),

      CONSTRAINT UQ_contactCode UNIQUE(contactCode)
    )
  `)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.raw('DROP TABLE application_profile')
}
