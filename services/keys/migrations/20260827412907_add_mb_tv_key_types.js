/**
 * Migration to add 'MB' (Miljöbod) and 'TV' (Tvättstuga) to the keys keyType enum,
 * then reclassify ÖVR keys tagged '(MB)' / '(TV)' in their name.
 *
 * MSSQL uses CHECK constraints for Knex enum columns.
 * We drop the existing constraint and re-create it with the new values.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Drop existing CHECK constraint on 'keyType' column
  await knex.raw(`
    DECLARE @constraintName NVARCHAR(200)
    SELECT @constraintName = name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('keys')
      AND definition LIKE '%keyType%'
    IF @constraintName IS NOT NULL
      EXEC('ALTER TABLE keys DROP CONSTRAINT ' + @constraintName)
  `)

  // Re-create with MB and TV added
  await knex.raw(`
    ALTER TABLE keys
    ADD CONSTRAINT CK_keys_keyType
    CHECK (keyType IN (N'HN', N'FS', N'MV', N'LGH', N'PB', N'GAR', N'LOK', N'HL', N'FÖR', N'SOP', N'MB', N'TV', N'ÖVR'))
  `)

  // Reclassify ÖVR keys tagged via their name and strip the now-redundant tag
  // (keep the original name if stripping would leave it empty)
  await knex.raw(`
    UPDATE keys SET
      keyType = N'MB',
      keyName = CASE
        WHEN LTRIM(RTRIM(REPLACE(keyName, N'(MB)', N''))) = N'' THEN keyName
        ELSE LTRIM(RTRIM(REPLACE(keyName, N'(MB)', N'')))
      END
    WHERE keyName LIKE '%(MB)%' AND keyType = N'ÖVR'
  `)
  await knex.raw(`
    UPDATE keys SET
      keyType = N'TV',
      keyName = CASE
        WHEN LTRIM(RTRIM(REPLACE(keyName, N'(TV)', N''))) = N'' THEN keyName
        ELSE LTRIM(RTRIM(REPLACE(keyName, N'(TV)', N'')))
      END
    WHERE keyName LIKE '%(TV)%' AND keyType = N'ÖVR'
  `)
}

/**
 * Rollback: revert MB/TV keys to ÖVR and restore the original CHECK constraint.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Re-prepend the name tag (pre-migration convention) and revert to ÖVR
  await knex.raw(`
    UPDATE keys SET keyName = N'(MB) ' + keyName, keyType = N'ÖVR'
    WHERE keyType = N'MB'
  `)
  await knex.raw(`
    UPDATE keys SET keyName = N'(TV) ' + keyName, keyType = N'ÖVR'
    WHERE keyType = N'TV'
  `)

  await knex.raw(`
    DECLARE @constraintName NVARCHAR(200)
    SELECT @constraintName = name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('keys')
      AND definition LIKE '%keyType%'
    IF @constraintName IS NOT NULL
      EXEC('ALTER TABLE keys DROP CONSTRAINT ' + @constraintName)
  `)

  await knex.raw(`
    ALTER TABLE keys
    ADD CONSTRAINT CK_keys_keyType
    CHECK (keyType IN (N'HN', N'FS', N'MV', N'LGH', N'PB', N'GAR', N'LOK', N'HL', N'FÖR', N'SOP', N'ÖVR'))
  `)
}
