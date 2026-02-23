/**
 * Migration for creating junction table key_bundle_keys.
 * Replaces JSON array column key_bundles.keys with a proper relational many-to-many table.
 *
 * Steps:
 * 1. Create junction table with FK constraints and index
 * 2. Populate junction table from existing JSON data
 * 3. Drop the old JSON column
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Create junction table
  await knex.raw(`
    CREATE TABLE key_bundle_keys (
      keyBundleId UNIQUEIDENTIFIER NOT NULL REFERENCES key_bundles(id) ON DELETE CASCADE,
      keyId UNIQUEIDENTIFIER NOT NULL REFERENCES keys(id),
      PRIMARY KEY (keyBundleId, keyId)
    )
  `)
  await knex.raw(
    `CREATE INDEX idx_key_bundle_keys_keyId ON key_bundle_keys(keyId)`
  )

  // 2. Populate from existing JSON data
  await knex.raw(`
    INSERT INTO key_bundle_keys (keyBundleId, keyId)
    SELECT DISTINCT kb.id, TRY_CAST(j.value AS UNIQUEIDENTIFIER)
    FROM key_bundles kb
    CROSS APPLY OPENJSON(kb.[keys]) j
    WHERE kb.[keys] IS NOT NULL
      AND kb.[keys] != '[]'
      AND TRY_CAST(j.value AS UNIQUEIDENTIFIER) IS NOT NULL
      AND EXISTS (SELECT 1 FROM keys k WHERE k.id = TRY_CAST(j.value AS UNIQUEIDENTIFIER))
  `)

  // 3. Drop the old JSON column
  await knex.schema.alterTable('key_bundles', (table) => {
    table.dropColumn('keys')
  })
}

/**
 * Rollback: recreate JSON column, repopulate from junction table, drop junction table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // 1. Recreate JSON column
  await knex.schema.alterTable('key_bundles', (table) => {
    table.text('keys').defaultTo('[]')
  })

  // 2. Repopulate JSON column from junction table
  await knex.raw(`
    UPDATE kb
    SET kb.[keys] = ISNULL((
      SELECT '[' + STRING_AGG('"' + CAST(bk.keyId AS NVARCHAR(36)) + '"', ',') + ']'
      FROM key_bundle_keys bk
      WHERE bk.keyBundleId = kb.id
    ), '[]')
    FROM key_bundles kb
  `)

  // 3. Drop junction table
  await knex.schema.dropTableIfExists('key_bundle_keys')
}
