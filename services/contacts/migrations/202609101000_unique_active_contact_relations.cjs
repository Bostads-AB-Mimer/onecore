/**
 * Both indexes are created over existing data, so a shared environment has to be
 * clean before this runs. Both queries must return no rows:
 *
 * SELECT subject_contact_code, related_contact_code, role_type, COUNT(*) AS n
 * FROM contact_relation WHERE deleted_at IS NULL
 * GROUP BY subject_contact_code, related_contact_code, role_type HAVING COUNT(*) > 1;
 *
 * SELECT subject_contact_code, COUNT(*) AS n
 * FROM contact_relation WHERE deleted_at IS NULL
 *   AND role_type IN ('god_man', 'forvaltare')
 * GROUP BY subject_contact_code HAVING COUNT(*) > 1;
 *
 * If they do not, the migration fails with MSSQL error 1505, which names the
 * index and the duplicate key value.
 */

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
