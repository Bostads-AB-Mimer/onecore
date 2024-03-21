/**
 * Migration for creating 'listing' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('listing', (table) => {
      table.increments('Id').primary();
      table.string('Address').notNullable();
      table.integer('MonthlyRent').notNullable();
      table.string('FreeField1Caption');
      table.string('FreeField1Code');
      table.string('FreeField3Caption');
      table.integer('FreeField3Code');
      table.string('ObjectTypeCaption');
      table.string('ObjectTypeCode');
      table.string('RentalPropertyId');
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
  