/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Lägg till nya kolumner först
  await knex.schema.alterTable('Listing', (table) => {
    table.string('RentalRule').nullable() // ska den vara nullable?
    table.string('ListingCategory').nullable() // ska den vara nullable?
  })

  // Flytta och mappa data från WaitingListType till RentalRule och ListingCategory
  await knex('Listing').where('WaitingListType', 'Bilplats (intern)').update({
    RentalRule: 'SCORED',
    ListingCategory: 'PARKING_SPACE',
  })

  await knex('Listing').where('WaitingListType', 'Bilplats (extern)').update({
    RentalRule: 'NON_SCORED',
    ListingCategory: 'PARKING_SPACE',
  })

  // Sätt defaultvärden på övriga rader om det behövs
  await knex('Listing').whereNull('RentalRule').update({ RentalRule: 'SCORED' })
  await knex('Listing')
    .whereNull('ListingCategory')
    .update({ ListingCategory: 'PARKING_SPACE' })

  // 3. Ändra till notNullable
  await knex.schema.alterTable('Listing', (table) => {
    table.string('RentalRule').notNullable().alter()
    table.string('ListingCategory').notNullable().alter()
  })

  // Ta bort gamla kolumner sist
  await knex.schema.alterTable('Listing', (table) => {
    table.dropColumn('Address')
    table.dropColumn('MonthlyRent')
    table.dropColumn('DistrictCaption')
    table.dropColumn('DistrictCode')
    table.dropColumn('BlockCaption')
    table.dropColumn('BlockCode')
    table.dropColumn('ObjectTypeCaption')
    table.dropColumn('ObjectTypeCode')
    table.dropColumn('RentalObjectTypeCaption')
    table.dropColumn('RentalObjectTypeCode')
    table.dropColumn('WaitingListType')
    table.dropColumn('VacantFrom')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('Listing', (table) => {
    // Återställ gamla kolumner
    // OBS att vi inte kan återställa data i dessa kolumner
    // eftersom de inte längre finns i databasen.
    table.string('Address').nullable()
    table.decimal('MonthlyRent').nullable()
    table.string('DistrictCaption').nullable()
    table.string('DistrictCode').nullable()
    table.string('BlockCaption').nullable()
    table.string('BlockCode').nullable()
    table.string('ObjectTypeCaption').nullable()
    table.string('ObjectTypeCode').nullable()
    table.string('RentalObjectTypeCaption').nullable()
    table.string('RentalObjectTypeCode').nullable()
    table.string('WaitingListType').nullable()
    table.dateTime('VacantFrom').nullable()
  })

  // Återställ WaitingListType baserat på RentalRule och ListingCategory
  await knex('Listing')
    .where({ ListingCategory: 'PARKING_SPACE', RentalRule: 'SCORED' })
    .update({ WaitingListType: 'Bilplats (intern)' })

  await knex('Listing')
    .where({ ListingCategory: 'PARKING_SPACE', RentalRule: 'NON_SCORED' })
    .update({ WaitingListType: 'Bilplats (extern)' })

  // Ta bort nya kolumner sist
  await knex.schema.alterTable('Listing', (table) => {
    table.dropColumn('RentalRule')
    table.dropColumn('ListingCategory')
  })
}
