/**
 * AvailableFrom overrides the computed vacancy date (vacantFrom, derived
 * from Tenfast lease data) when a leasing officer knows better — e.g. a
 * renovation running long. Null means "use the computed value".
 * TentativeAvailableFrom has no computed equivalent: an unconfirmed earlier
 * move-out date ("Eventuellt tillgänglig från").
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('listing', (table) => {
    table.dateTime('AvailableFrom').nullable()
    table.dateTime('TentativeAvailableFrom').nullable()
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('listing', (table) => {
    table.dropColumn('AvailableFrom')
    table.dropColumn('TentativeAvailableFrom')
  })
}
