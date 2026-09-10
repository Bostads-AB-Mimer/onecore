/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE UNIQUE INDEX ux_contact_relation_active_edge
        ON contact_relation (subject_contact_code, related_contact_code, role_type)
        WHERE deleted_at IS NULL;

      CREATE UNIQUE INDEX ux_contact_relation_active_guardian
        ON contact_relation (subject_contact_code)
        WHERE deleted_at IS NULL AND role_type IN ('god_man', 'forvaltare');
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
      DROP INDEX IF EXISTS ux_contact_relation_active_guardian ON contact_relation;
      DROP INDEX IF EXISTS ux_contact_relation_active_edge ON contact_relation;
    `)
  })
}
