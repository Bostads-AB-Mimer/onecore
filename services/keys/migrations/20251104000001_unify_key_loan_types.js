/**
 * Migration for unifying key loan types.
 * Adds loanType, contactPerson, and description to key_loans table.
 * Migrates data from key_loan_maintenance_keys and drops that table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function (knex) {
  // Step 1: Add new columns to key_loans table
  await knex.schema.alterTable('key_loans', (table) => {
    table
      .enum('loanType', ['TENANT', 'MAINTENANCE'])
      .notNullable()
      .defaultTo('TENANT')
    table.string('contactPerson').nullable()
    table.text('description').nullable()
  })

  // Step 2: Migrate existing data from key_loan_maintenance_keys to key_loans
  const maintenanceLoans = await knex('key_loan_maintenance_keys').select('*')

  if (maintenanceLoans.length > 0) {
    const migratedLoans = maintenanceLoans.map((loan) => ({
      id: loan.id,
      keys: loan.keys || '[]',
      contact: loan.company, // company becomes contact
      contact2: null,
      contactPerson: loan.contactPerson,
      description: loan.description,
      returnedAt: loan.returnedAt,
      availableToNextTenantFrom: null,
      pickedUpAt: loan.pickedUpAt,
      createdAt: loan.createdAt,
      updatedAt: loan.createdAt, // Use createdAt since updatedAt doesn't exist
      createdBy: null,
      updatedBy: null,
      loanType: 'MAINTENANCE',
    }))

    await knex('key_loans').insert(migratedLoans)
  }

  // Step 3: Drop the key_loan_maintenance_keys table
  await knex.schema.dropTableIfExists('key_loan_maintenance_keys')

  // Step 4: Remove loanType column from receipts (no longer needed - can look it up from key_loans)
  // First drop the index
  await knex.schema.alterTable('receipts', (table) => {
    table.dropIndex('loanType', 'idx_receipts_loan_type')
  })

  // Then drop the check constraint
  await knex.raw(`
    ALTER TABLE receipts
    DROP CONSTRAINT IF EXISTS receipts_loan_type_check
  `)

  // Finally drop the column
  await knex.schema.alterTable('receipts', (table) => {
    table.dropColumn('loanType')
  })
}

/**
 * Migration rollback - recreates key_loan_maintenance_keys and restores data.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = async function (knex) {
  // Step 1: Re-add loanType column to receipts
  await knex.schema.alterTable('receipts', (table) => {
    table.enum('loanType', ['TENANT', 'MAINTENANCE'])
  })

  // Step 2: Populate loanType in receipts from key_loans
  await knex.raw(`
    UPDATE receipts
    SET loanType = (
      SELECT loanType
      FROM key_loans
      WHERE key_loans.id = receipts.keyLoanId
    )
  `)

  // Step 3: Recreate key_loan_maintenance_keys table
  await knex.schema.createTable('key_loan_maintenance_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.text('keys').defaultTo('[]')
    table.string('company')
    table.string('contactPerson')
    table.timestamp('returnedAt')
    table.text('description')
    table.timestamp('pickedUpAt')
    table.timestamp('createdAt').defaultTo(knex.fn.now())
  })

  // Step 4: Migrate MAINTENANCE loans back to key_loan_maintenance_keys
  const maintenanceLoans = await knex('key_loans')
    .where('loanType', 'MAINTENANCE')
    .select('*')

  if (maintenanceLoans.length > 0) {
    const restoredLoans = maintenanceLoans.map((loan) => ({
      id: loan.id,
      keys: loan.keys,
      company: loan.contact, // contact becomes company again
      contactPerson: loan.contactPerson,
      description: loan.description,
      returnedAt: loan.returnedAt,
      pickedUpAt: loan.pickedUpAt,
      createdAt: loan.createdAt,
    }))

    await knex('key_loan_maintenance_keys').insert(restoredLoans)
  }

  // Step 5: Delete MAINTENANCE loans from key_loans
  await knex('key_loans').where('loanType', 'MAINTENANCE').delete()

  // Step 6: Remove new columns from key_loans
  await knex.schema.alterTable('key_loans', (table) => {
    table.dropColumn('loanType')
    table.dropColumn('contactPerson')
    table.dropColumn('description')
  })
}
