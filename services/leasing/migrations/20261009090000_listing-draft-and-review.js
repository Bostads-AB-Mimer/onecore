/**
 * Housing listings start as drafts (Status 5) without a publish date, and
 * carry a review stamp ("Granskad – redo att publicera") separate from
 * publishing. PublishedFrom is set the moment a listing is published.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('listing', (table) => {
    table.dateTime('PublishedFrom').nullable().alter()
    table.dateTime('ReviewedAt').nullable()
    table.string('ReviewedBy').nullable()
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.schema.alterTable('listing', (table) => {
      table.dropColumn('ReviewedAt')
      table.dropColumn('ReviewedBy')
    })
    // Drafts have no publish date; stamp them so the NOT NULL can come back.
    await trx('listing').whereNull('PublishedFrom').update({
      PublishedFrom: trx.fn.now(),
    })
    await trx.schema.alterTable('listing', (table) => {
      table.dateTime('PublishedFrom').notNullable().alter()
    })
  })
}
