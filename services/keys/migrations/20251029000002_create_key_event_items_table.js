/**
 * Migration for creating 'key_event_items' junction table.
 * This table replaces the JSON array in key_events.keys with a proper many-to-many relationship.
 *
 * Performance benefits:
 * - Enables indexed lookups instead of LIKE '%...%' pattern matching
 * - Eliminates full table scans in OUTER APPLY subqueries
 * - Allows foreign key constraints for data integrity
 * - Supports standard SQL query optimization
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable('key_event_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'))
    table.uuid('keyEventId').notNullable().references('id').inTable('key_events').onDelete('CASCADE')
    table.uuid('keyId').notNullable().references('id').inTable('keys').onDelete('CASCADE')
    table.timestamp('createdAt').defaultTo(knex.fn.now())

    // Ensure a key can only appear once per event
    table.unique(['keyEventId', 'keyId'])

    // Indexes for efficient lookups
    table.index('keyEventId', 'idx_key_event_items_event_id')
    table.index('keyId', 'idx_key_event_items_key_id')
  })
}

/**
 * Migration for dropping 'key_event_items' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = function (knex) {
  return knex.schema.dropTable('key_event_items')
}
