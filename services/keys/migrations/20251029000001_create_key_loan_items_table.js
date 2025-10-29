/**
 * Migration for creating 'key_loan_items' junction table.
 * This table replaces the JSON array in key_loans.keys with a proper many-to-many relationship.
 *
 * Performance benefits:
 * - Enables indexed lookups (O(1) instead of O(N×M) with OPENJSON)
 * - Eliminates cartesian products in JOIN operations
 * - Allows foreign key constraints for data integrity
 * - Supports standard SQL query optimization
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_loan_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.uuid('keyLoanId').notNullable().references('id').inTable('key_loans').onDelete('CASCADE')
    table.uuid('keyId').notNullable().references('id').inTable('keys').onDelete('CASCADE')
    table.timestamp('createdAt').defaultTo(knex.fn.now())

    // Ensure a key can only appear once per loan
    table.unique(['keyLoanId', 'keyId'])

    // Indexes for efficient lookups
    table.index('keyLoanId', 'idx_key_loan_items_loan_id')
    table.index('keyId', 'idx_key_loan_items_key_id')
  })
}

/**
 * Migration for dropping 'key_loan_items' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema.dropTable('key_loan_items')
}
