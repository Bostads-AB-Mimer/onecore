/**
 * Migration for creating 'applicant' table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('applicant', (table) => {
      table.increments('Id').primary();
      table.string('Name').notNullable();
      table.string('ContactCode').notNullable();
      table.dateTime('ApplicationDate').notNullable();
      table.string('ApplicationType');
      table.string('RentalObjectCode');
      table.integer('Status').notNullable();
      table.integer('ListingId').unsigned();
      table.foreign('ListingId').references('listing.Id');
    });
  };
  
  /**
   * Migration for dropping 'applicant' table.
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('applicant');
  };
  