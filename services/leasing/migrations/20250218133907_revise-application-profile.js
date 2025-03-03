/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
       ALTER TABLE application_profile_housing_reference
       DROP COLUMN
         lastAdminUpdatedBy,
         lastAdminUpdatedAt,
         lastApplicantUpdatedAt;
    `)

    await trx.raw(`
      ALTER TABLE application_profile_housing_reference
      ADD 
        reviewedAt datetimeoffset,
        reviewedBy nvarchar(36);
    `)

    await trx.raw(`
      ALTER TABLE application_profile
      ADD lastUpdatedAt datetimeoffset;
    `)

    await trx.raw(`
      INSERT INTO application_profile_housing_reference (applicationProfileId, reviewStatus, createdAt)
      SELECT 
        ap.id as applicationProfileId,
        'PENDING' as reviewStatus,
        GETUTCDATE() as createdAt
      FROM application_profile ap
      WHERE NOT EXISTS (
        SELECT 1 
        FROM application_profile_housing_reference hr 
        WHERE hr.applicationProfileId = ap.id
      );
    `)

    await trx.raw(`
      UPDATE application_profile
      SET expiresAt = GETUTCDATE();
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
       ADD
         lastAdminUpdatedBy nvarchar(36),
         lastAdminUpdatedAt datetimeoffset,
         lastApplicantUpdatedAt datetimeoffset;
    `)

    await trx.raw(`
       UPDATE application_profile_housing_reference
       SET lastApplicantUpdatedAt = createdAt;
    `)

    await trx.raw(`
      ALTER TABLE application_profile_housing_reference
      DROP COLUMN
        reviewedAt,
        reviewedBy;
    `)

    await trx.raw(`
      ALTER TABLE application_profile
      DROP COLUMN lastUpdatedAt;
    `)
  })
}
