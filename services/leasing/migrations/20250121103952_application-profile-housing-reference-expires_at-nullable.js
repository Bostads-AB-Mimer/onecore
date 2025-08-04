/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.raw(`
       ALTER TABLE application_profile_housing_reference
       ALTER COLUMN expiresAt datetimeoffset NULL;
     `)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.raw(`
       ALTER TABLE application_profile_housing_reference
       ALTER COLUMN expiresAt datetimeoffset NOT NULL;
     `)
}
