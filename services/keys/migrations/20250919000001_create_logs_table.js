/**
 * Migration for creating 'logs' table.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))

    // Who performed action 
    table.string('user_name').notNullable()

    // What happened
    table
      .enum('event_type', ['update', 'creation', 'delete'])
      .notNullable()

    // Which object type changes
    table
      .enum('object_type', ['key_system', 'key', 'key_loan'])
      .notNullable()

    table.timestamp('event_time').defaultTo(knex.fn.now())

    table.string('description', 1000)

    // Helpful indexes
    table.index(['object_type'])
    table.index(['event_time'])
  })
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('logs')
}
