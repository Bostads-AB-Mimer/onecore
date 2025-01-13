/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE application_profile_housing_reference
      ALTER COLUMN phone nvarchar(36) NULL;
    `)

    await trx.raw(`
      ALTER TABLE application_profile_housing_reference
      ADD
          comment nvarchar(max),
          reasonRejected nvarchar(36),
          lastAdminUpdatedAt datetimeoffset,
          lastAdminUpdatedBy nvarchar(36),
          lastApplicantUpdatedAt datetimeoffset;
    `)

    await trx.raw(`
      ALTER TABLE application_profile_housing_reference
      DROP COLUMN reviewStatusReason, reviewedAt;
    `)

    await trx.raw(`
      ALTER TABLE application_profile
      ALTER COLUMN housingType nvarchar(36) NOT NULL;
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
       ALTER TABLE application_profile_housing_reference
       ADD reviewStatusReason nvarchar(max),
           reviewedAt datetimeoffset;
     `)

    await trx.raw(`
       ALTER TABLE application_profile_housing_reference
       DROP COLUMN
            comment,
            reasonRejected,
            lastAdminUpdatedAt,
            lastApplicantUpdatedAt,
            lastAdminUpdatedBy;
     `)

    await trx.raw(`
       ALTER TABLE application_profile_housing_reference
       ALTER COLUMN phone nvarchar(36) NOT NULL;
     `)

    await trx.raw(`
      ALTER TABLE application_profile
      ALTER COLUMN housingType nvarchar(36) NULL;
    `)
  })
}
