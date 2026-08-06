/**
 * Adds the four boolean safety-check columns captured in the "Kontrollfrågor"
 * step. NOT NULL with default 0 so the columns are always present — keeps
 * reads schemaful and avoids the parser/fallback dance a JSON column would
 * need.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE inspection
        ADD groundFaultBreaker BIT NOT NULL CONSTRAINT df_inspection_groundFaultBreaker DEFAULT 0,
            smokeDetector BIT NOT NULL CONSTRAINT df_inspection_smokeDetector DEFAULT 0,
            electricalSchema BIT NOT NULL CONSTRAINT df_inspection_electricalSchema DEFAULT 0,
            electricalSystem BIT NOT NULL CONSTRAINT df_inspection_electricalSystem DEFAULT 0;
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    // SQL Server requires dropping the default constraint by name before the
    // column can be removed.
    await trx.raw(`
      ALTER TABLE inspection DROP CONSTRAINT df_inspection_groundFaultBreaker;
      ALTER TABLE inspection DROP CONSTRAINT df_inspection_smokeDetector;
      ALTER TABLE inspection DROP CONSTRAINT df_inspection_electricalSchema;
      ALTER TABLE inspection DROP CONSTRAINT df_inspection_electricalSystem;
      ALTER TABLE inspection
        DROP COLUMN groundFaultBreaker,
                    smokeDetector,
                    electricalSchema,
                    electricalSystem;
    `)
  })
}
