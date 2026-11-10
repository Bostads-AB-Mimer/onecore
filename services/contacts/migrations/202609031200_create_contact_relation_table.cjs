/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE contact_relation (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        subject_contact_code NVARCHAR(50) NOT NULL,
        related_contact_code NVARCHAR(50) NOT NULL,
        role_type NVARCHAR(30) NOT NULL CONSTRAINT ck_contact_relation_role_type
          CHECK (role_type IN ('god_man', 'forvaltare', 'annan_fakturamottagare')),
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        created_by NVARCHAR(100) NOT NULL,
        deleted_at DATETIME2 NULL,
        deleted_by NVARCHAR(100) NULL
      );

      CREATE INDEX idx_contact_relation_subject ON contact_relation(subject_contact_code, role_type);
      CREATE INDEX idx_contact_relation_related ON contact_relation(related_contact_code, role_type);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS contact_relation;`)
  })
}
