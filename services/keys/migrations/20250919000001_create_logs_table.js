/**
 * Migration for creating 'logs' table.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))

    // Who performed action
    table.string('userName').notNullable()

    // What happened
    table
      .enum('eventType', ['update', 'creation', 'delete'])
      .notNullable()

    // Which object type changes
    table
      .enum('objectType', ['key_system', 'key', 'key_loan'])
      .notNullable()

    // ID of the object that was changed
    table.uuid('objectId').nullable()

    table.timestamp('eventTime').defaultTo(knex.fn.now())

    table.string('description', 1000)

    // Helpful indexes
    table.index(['objectType'])
    table.index(['eventTime'])
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('logs')
}
