/**
 * Migration for creating 'listing' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('listing', (table) => {
      table.increments('Id').primary();
      table.string('RentalObjectCode').unique().notNullable();
      table.string('Address').notNullable();
      table.decimal('MonthlyRent').notNullable();
      table.string('DistrictCaption'); // Updated to match the new interface
      table.string('DistrictCode'); // Updated to match the new interface
      table.string('BlockCaption'); // Updated to match the new interface
      table.string('BlockCode'); // Updated to match the new interface
      table.string('ObjectTypeCaption');
      table.string('ObjectTypeCode');
      table.string('RentalObjectTypeCaption');
      table.string('RentalObjectTypeCode');
      table.dateTime('PublishedFrom').notNullable();
      table.dateTime('PublishedTo').notNullable();
      table.dateTime('VacantFrom').notNullable();
      table.integer('Status').notNullable();
      table.string('WaitingListType');
    });
  };
  
  /**
   * Migration for dropping 'listing' table.
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('listing');
  };
  