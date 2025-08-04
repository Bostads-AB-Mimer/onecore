/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('MaterialOptionGroup', (table) => {
      table
        .string('MaterialOptionGroupId')
        .primary()
        .defaultTo(knex.raw('NEWID()'))
      table.string('RoomType')
      table.string('Name')
      table.string('ActionName')
      table.string('Type')
    })
    .createTable('MaterialOption', (table) => {
      table.string('MaterialOptionId').primary().defaultTo(knex.raw('NEWID()'))
      table.string('MaterialOptionGroupId')
      table.string('Caption')
      table.string('ShortDescription')
      table.string('CoverImage')
      table.string('Description')

      table
        .foreign('MaterialOptionGroupId')
        .references('MaterialOptionGroup.MaterialOptionGroupId')
    })
    .createTable('MaterialOptionImage', (table) => {
      table
        .string('MaterialOptionImageId')
        .primary()
        .defaultTo(knex.raw('NEWID()'))
      table.string('MaterialOptionId')
      table.string('Image')

      table
        .foreign('MaterialOptionId')
        .references('MaterialOption.MaterialOptionId')
    })
    .createTable('MaterialChoice', (table) => {
      table.string('MaterialChoiceId').primary().defaultTo(knex.raw('NEWID()'))
      table.string('MaterialOptionId')
      table.string('ApartmentId')
      table.string('RoomType')
      table.string('Status')
      table.dateTime('DateOfSubmission')
      table.dateTime('DateOfCancellation')

      table
        .foreign('MaterialOptionId')
        .references('MaterialOption.MaterialOptionId')
    })
    .createTable('ProjectApartment', (table) => {
      table
        .string('ProjectApartmentId')
        .primary()
        .defaultTo(knex.raw('NEWID()'))
      table.string('ApartmentId')
      table.string('ProjectCode')
      table.date('FirstDayOfMaterialChoice')
      table.date('LastDayOfMaterialChoice')

      table.unique(['ApartmentId', 'ProjectCode'])
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('ProjectApartment')
    .dropTableIfExists('MaterialChoice')
    .dropTableIfExists('MaterialOptionImage')
    .dropTableIfExists('MaterialOption')
    .dropTableIfExists('MaterialOptionGroup')
}
