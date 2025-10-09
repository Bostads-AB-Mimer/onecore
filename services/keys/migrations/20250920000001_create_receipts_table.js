/**
 * Migration for creating 'receipts' table.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('receipts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))

    // Foreign key to key_loans table
    table
      .uuid('keyLoanId')
      .notNullable()
      .references('id')
      .inTable('key_loans')
      .onDelete('CASCADE')

    // Type of receipt: LOAN or RETURN
    table.enum('receiptType', ['LOAN', 'RETURN']).notNullable()

    // Receipt format: DIGITAL or PHYSICAL
    table.enum('type', ['DIGITAL', 'PHYSICAL']).notNullable()

    // Whether the receipt has been signed
    table.boolean('signed').notNullable().defaultTo(false)

    // MinIO file identifier (blob storage)
    table.string('fileId').nullable()

    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())

    // Helpful indexes
    table.index(['keyLoanId'])
    table.index(['createdAt'])
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('receipts')
}
