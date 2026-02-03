/**
 * Migration to add 'loanType' column to receipts table
 * Purpose: Support both regular key loans and maintenance key loans
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('receipts', 'loanType')
  if (!hasColumn) {
    await knex.schema.alterTable('receipts', (table) => {
      // Add loanType column with default 'REGULAR' for existing records
      table.string('loanType', 20).notNullable().defaultTo('REGULAR')
    })

    // Add check constraint to ensure valid loanType values
    await knex.raw(`
      ALTER TABLE receipts
      ADD CONSTRAINT receipts_loan_type_check
      CHECK ("loanType" IN ('REGULAR', 'MAINTENANCE'))
    `)

    // Add index for querying by loanType
    await knex.schema.alterTable('receipts', (table) => {
      table.index('loanType', 'idx_receipts_loan_type')
    })
  }
}

/**
 * Rollback: Remove loanType column and related constraints/indexes
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('receipts', 'loanType')
  if (hasColumn) {
    // Drop index
    await knex.schema.alterTable('receipts', (table) => {
      table.dropIndex('loanType', 'idx_receipts_loan_type')
    })

    // Drop check constraint
    await knex.raw(`
      ALTER TABLE receipts
      DROP CONSTRAINT IF EXISTS receipts_loan_type_check
    `)

    // Drop column
    await knex.schema.alterTable('receipts', (table) => {
      table.dropColumn('loanType')
    })
  }
}
