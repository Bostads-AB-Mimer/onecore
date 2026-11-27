// Rep (SMS) template bodies become markdown, and their SMS text is the body
// with the markdown stripped. Plain text is almost valid markdown already;
// these are the patterns that would change what an existing template sends.
const ESCAPE_ANYWHERE = /[\\`*_[\]<>&|]/g
// Line starts markdown reads as a heading, quote, list, rule, fence or table.
const LINE_START = /^( {0,3})([#>+=~-])/
const ORDERED_ITEM = /^( {0,3}\d{1,9})([.)])/

/** Escapes plain text so markdown renders it as exactly the same text. */
const escapePlainText = (text) =>
  text
    .split('\n')
    .map((line) =>
      line
        .replace(ESCAPE_ANYWHERE, (ch) => `\\${ch}`)
        .replace(LINE_START, '$1\\$2')
        .replace(ORDERED_ITEM, '$1\\$2')
    )
    .join('\n')

/**
 * Adds `revision` (optimistic concurrency: an update must send the revision
 * it loaded) and `updatedBy` (who saved last), and escapes existing rep
 * template bodies for the markdown editor.
 *
 * From here on the DB is the source of all template text, system templates
 * included; the seed files in system-email-templates/ are only where they
 * started. One statement per batch, as MSSQL compiles a batch before running it.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE template
        ADD revision INT NOT NULL CONSTRAINT df_template_revision DEFAULT 1;
    `)
    await trx.raw(`ALTER TABLE template ADD updatedBy NVARCHAR(255) NULL;`)

    // Few rows (rep templates are hand-made), so one update per changed row.
    const rows = await trx('template')
      .whereNull('systemKey')
      .select('id', 'body')
    for (const row of rows) {
      const escaped = escapePlainText(row.body)
      if (escaped !== row.body) {
        await trx('template').where('id', row.id).update({ body: escaped })
      }
    }
  })
}

/**
 * Bodies stay escaped: un-escaping can't tell an escape this migration added
 * from one a user saved through the editor.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`ALTER TABLE template DROP COLUMN updatedBy;`)
    await trx.raw(`ALTER TABLE template DROP CONSTRAINT df_template_revision;`)
    await trx.raw(`ALTER TABLE template DROP COLUMN revision;`)
  })
}

// Exported for its test; knex only reads up/down.
exports.escapePlainText = escapePlainText
