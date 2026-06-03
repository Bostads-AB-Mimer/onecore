/**
 * Adds a JSON-encoded checklist column to inspection. Stores four booleans
 * (groundFaultBreaker, smokeDetector, electricalSchema, electricalSystem)
 * captured in the new "Kontrollfrågor" step (MIM-1818). Stored as a single
 * column so the shape can evolve without further schema changes; mirrors the
 * `draftRooms` precedent.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE inspection ADD checklist NVARCHAR(MAX) NULL;
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`ALTER TABLE inspection DROP COLUMN checklist;`)
  })
}
