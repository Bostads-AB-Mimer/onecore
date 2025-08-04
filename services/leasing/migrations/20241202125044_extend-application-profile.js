/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE application_profile
      ADD housingType nvarchar(36),
          housingTypeDescription nvarchar(max),
          landlord nvarchar(36);
    `)

    await trx.raw(`
      CREATE TABLE application_profile_housing_reference (
        id int NOT NULL PRIMARY KEY IDENTITY(1,1),
        applicationProfileId int NOT NULL,
        phone nvarchar(36) NOT NULL,
        email nvarchar(max),
        reviewStatus nvarchar(36) NOT NULL,
        reviewStatusReason nvarchar(max),
        reviewedAt datetimeoffset,
        expiresAt datetimeoffset NOT NULL,
        createdAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        FOREIGN KEY (applicationProfileId) REFERENCES application_profile(id),
        CONSTRAINT UQ_applicationProfileId UNIQUE(applicationProfileId)
      )
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
      ALTER TABLE application_profile
      DROP COLUMN housingType, housingTypeDescription, landlord
    `)

    await trx.raw(`
      DROP TABLE application_profile_housing_reference
    `)
  })
}
