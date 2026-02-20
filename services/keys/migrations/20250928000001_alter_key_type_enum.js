/**
 * Migration to expand keyType enum with new values
 * New types: MV (Motorvärmarnyckel), GAR (Garagenyckel), LOK (Lokalnyckel),
 *            HL (Hänglås), FÖR (Förrådsnyckel), SOP (Sopsug), ÖVR (Övrigt)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Drop the old keyType column
  await knex.schema.alterTable('keys', (table) => {
    table.dropColumn('keyType')
  })

  // Add the new keyType column with expanded values and a default
  await knex.schema.alterTable('keys', (table) => {
    table.enum('keyType', ['HN', 'FS', 'MV', 'LGH', 'PB', 'GAR', 'LOK', 'HL', 'FÖR', 'SOP', 'ÖVR']).notNullable().defaultTo('LGH')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Drop the new keyType column
  await knex.schema.alterTable('keys', (table) => {
    table.dropColumn('keyType')
  })

  // Restore the old keyType column
  await knex.schema.alterTable('keys', (table) => {
    table.enum('keyType', ['LGH', 'PB', 'FS', 'HN']).notNullable()
  })
}
