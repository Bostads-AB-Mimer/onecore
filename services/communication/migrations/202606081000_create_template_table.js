/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE template (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        channels NVARCHAR(50) NOT NULL,
        subject NVARCHAR(500) NULL,
        body NVARCHAR(MAX) NOT NULL,
        categories NVARCHAR(500) NULL,
        status BIT NOT NULL DEFAULT 1,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX idx_template_status ON template(status);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS template;`)
  })
}
