/**
 * Migration for creating 'signatures' table.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('signatures', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))

    // Polymorphic association
    table.enum('resourceType', ['receipt']).notNullable()
    table.uuid('resourceId').notNullable()

    // SimpleSign integration
    table.integer('simpleSignDocumentId').notNullable().unique()

    // Recipient information
    table.string('recipientEmail').notNullable()
    table.string('recipientName').nullable()

    // Status tracking
    table.string('status').notNullable().defaultTo('sent')

    // Timestamps
    table.timestamp('sentAt').notNullable().defaultTo(knex.fn.now())
    table.timestamp('completedAt').nullable()
    table.timestamp('lastSyncedAt').nullable()

    // Indexes
    table.index(['resourceType', 'resourceId'])
    table.index(['status'])
    table.index(['simpleSignDocumentId'])
    table.index(['sentAt'])
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('signatures')
}
