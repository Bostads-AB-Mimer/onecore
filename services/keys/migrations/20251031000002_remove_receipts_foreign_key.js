/**
 * Migration to remove foreign key constraint from receipts.keyLoanId
 * This allows receipts to reference either key_loans OR key_loan_maintenance_keys
 * based on the loanType discriminator field.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  // Drop the foreign key constraint if it exists
  // Note: Knex doesn't have a direct method to drop constraints by name in MSSQL,
  // so we need to use raw SQL with conditional check
  await knex.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'receipts_keyloanid_foreign'
      AND parent_object_id = OBJECT_ID('receipts')
    )
    BEGIN
      ALTER TABLE receipts
      DROP CONSTRAINT receipts_keyloanid_foreign
    END
  `)
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  // Re-add the foreign key constraint to key_loans only
  // This will only work if all receipts reference valid key_loans
  await knex.raw(`
    ALTER TABLE receipts
    ADD CONSTRAINT receipts_keyloanid_foreign
    FOREIGN KEY (keyLoanId) REFERENCES key_loans(id) ON DELETE CASCADE
  `)
}
