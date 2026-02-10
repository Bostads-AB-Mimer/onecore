/**
 * Migration for creating junction tables key_loan_keys, key_loan_cards, and key_event_keys.
 * Replaces JSON array columns with proper relational many-to-many tables.
 *
 * Steps:
 * 1. Create junction tables with FK constraints and indexes
 * 2. Populate junction tables from existing JSON data
 * 3. Drop the old JSON columns
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Create junction tables
  await knex.raw(`
    CREATE TABLE key_loan_keys (
      keyLoanId UNIQUEIDENTIFIER NOT NULL REFERENCES key_loans(id) ON DELETE CASCADE,
      keyId UNIQUEIDENTIFIER NOT NULL REFERENCES keys(id),
      PRIMARY KEY (keyLoanId, keyId)
    )
  `)
  await knex.raw(
    `CREATE INDEX idx_key_loan_keys_keyId ON key_loan_keys(keyId)`
  )

  await knex.raw(`
    CREATE TABLE key_loan_cards (
      keyLoanId UNIQUEIDENTIFIER NOT NULL REFERENCES key_loans(id) ON DELETE CASCADE,
      cardId VARCHAR(255) NOT NULL,
      PRIMARY KEY (keyLoanId, cardId)
    )
  `)
  await knex.raw(
    `CREATE INDEX idx_key_loan_cards_card ON key_loan_cards(cardId)`
  )

  await knex.raw(`
    CREATE TABLE key_event_keys (
      keyEventId UNIQUEIDENTIFIER NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,
      keyId UNIQUEIDENTIFIER NOT NULL REFERENCES keys(id),
      PRIMARY KEY (keyEventId, keyId)
    )
  `)
  await knex.raw(
    `CREATE INDEX idx_key_event_keys_keyId ON key_event_keys(keyId)`
  )

  // 2. Populate from existing JSON data
  await knex.raw(`
    INSERT INTO key_loan_keys (keyLoanId, keyId)
    SELECT DISTINCT kl.id, TRY_CAST(j.value AS UNIQUEIDENTIFIER)
    FROM key_loans kl
    CROSS APPLY OPENJSON(kl.[keys]) j
    WHERE kl.[keys] IS NOT NULL
      AND kl.[keys] != '[]'
      AND TRY_CAST(j.value AS UNIQUEIDENTIFIER) IS NOT NULL
      AND EXISTS (SELECT 1 FROM keys k WHERE k.id = TRY_CAST(j.value AS UNIQUEIDENTIFIER))
  `)

  await knex.raw(`
    INSERT INTO key_loan_cards (keyLoanId, cardId)
    SELECT DISTINCT kl.id, j.value
    FROM key_loans kl
    CROSS APPLY OPENJSON(kl.keyCards) j
    WHERE kl.keyCards IS NOT NULL
      AND kl.keyCards != '[]'
  `)

  await knex.raw(`
    INSERT INTO key_event_keys (keyEventId, keyId)
    SELECT DISTINCT ke.id, TRY_CAST(j.value AS UNIQUEIDENTIFIER)
    FROM key_events ke
    CROSS APPLY OPENJSON(ke.[keys]) j
    WHERE ke.[keys] IS NOT NULL
      AND ke.[keys] != '[]'
      AND TRY_CAST(j.value AS UNIQUEIDENTIFIER) IS NOT NULL
      AND EXISTS (SELECT 1 FROM keys k WHERE k.id = TRY_CAST(j.value AS UNIQUEIDENTIFIER))
  `)

  // 3. Drop the old JSON columns
  await knex.schema.alterTable('key_loans', (table) => {
    table.dropColumn('keys')
    table.dropColumn('keyCards')
  })

  await knex.schema.alterTable('key_events', (table) => {
    table.dropColumn('keys')
  })
}

/**
 * Rollback: recreate JSON columns, repopulate from junction tables, drop junction tables.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // 1. Recreate JSON columns
  await knex.schema.alterTable('key_loans', (table) => {
    table.text('keys').defaultTo('[]')
    table.text('keyCards').nullable().defaultTo('[]')
  })

  await knex.schema.alterTable('key_events', (table) => {
    table.string('keys').notNullable().defaultTo('[]')
  })

  // 2. Repopulate JSON columns from junction tables
  await knex.raw(`
    UPDATE kl
    SET kl.[keys] = ISNULL((
      SELECT '[' + STRING_AGG('"' + CAST(klk.keyId AS NVARCHAR(36)) + '"', ',') + ']'
      FROM key_loan_keys klk
      WHERE klk.keyLoanId = kl.id
    ), '[]')
    FROM key_loans kl
  `)

  await knex.raw(`
    UPDATE kl
    SET kl.keyCards = ISNULL((
      SELECT '[' + STRING_AGG('"' + klc.cardId + '"', ',') + ']'
      FROM key_loan_cards klc
      WHERE klc.keyLoanId = kl.id
    ), '[]')
    FROM key_loans kl
  `)

  await knex.raw(`
    UPDATE ke
    SET ke.[keys] = ISNULL((
      SELECT '[' + STRING_AGG('"' + CAST(kek.keyId AS NVARCHAR(36)) + '"', ',') + ']'
      FROM key_event_keys kek
      WHERE kek.keyEventId = ke.id
    ), '[]')
    FROM key_events ke
  `)

  // 3. Drop junction tables
  await knex.schema.dropTableIfExists('key_event_keys')
  await knex.schema.dropTableIfExists('key_loan_cards')
  await knex.schema.dropTableIfExists('key_loan_keys')
}
